import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { providerError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { buildSrt } from '../../lib/srt.js'
import { parseJsonStdout, run, runOrThrow } from '../../lib/proc.js'
import type { Logger, PostPort, SubtitleStyle } from '../../kernel/ports.js'

/**
 * Post production: score mixing, subtitle timing, subtitle burn-in.
 *
 * All three are finishing operations on a finished picture, and all three are
 * ffmpeg jobs — which is why they share a port rather than being bolted onto
 * `export`. Swapping in a cloud finishing service means replacing this one file.
 */
export default definePlugin<PostPort>({
  port: 'post',
  name: 'ffmpeg',
  create: (options, deps) => {
    const bin = typeof options['bin'] === 'string' ? options['bin'] : 'ffmpeg'
    const probeBin = typeof options['probeBin'] === 'string' ? options['probeBin'] : 'ffprobe'

    const probeSeconds = async (path: string): Promise<number> => {
      const result = await runOrThrow(
        probeBin,
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', path],
        { timeoutMs: 60_000 },
      )
      const parsed = parseJsonStdout<{ format?: { duration?: string } }>(result.stdout, 'ffprobe')
      const seconds = Number(parsed.format?.duration)
      if (!Number.isFinite(seconds)) {
        throw providerError(`ffprobe could not read a duration from ${path}`)
      }
      return seconds
    }

    return {
      name: 'ffmpeg',

      probeDuration: async (asset, store) => probeSeconds(await store.localPath(asset)),

      concatAudio: async (tracks, store, projectId) => {
        if (tracks.length === 0) {
          throw providerError('concatAudio: nothing to join.')
        }
        const paths = await Promise.all(tracks.map((t) => store.localPath(t)))
        const dir = await mkdtemp(join(tmpdir(), 'duanju-vjoin-'))
        const out = join(dir, 'voice.mp3')

        // Re-encode rather than stream-copy: the takes come back as separate
        // MP3s whose frame boundaries do not line up, and a copy-concat of
        // those plays back with a click at every seam.
        const inputs = paths.flatMap((p) => ['-i', p])
        const filter = `${paths.map((_p, i) => `[${i}:a]`).join('')}concat=n=${paths.length}:v=0:a=1[a]`

        await runOrThrow(
          bin,
          [
            '-y', '-hide_banner', '-loglevel', 'error',
            ...inputs,
            '-filter_complex', filter,
            '-map', '[a]',
            '-c:a', 'libmp3lame', '-b:a', '160k',
            out,
          ],
          { timeoutMs: 120_000, log: deps.log },
        )

        const bytes = new Uint8Array(await readFile(out))
        return store.put(bytes, {
          kind: 'other',
          mime: 'audio/mpeg',
          projectId,
          label: `voice-joined-${tracks.length}`,
        })
      },

      stripAudio: async (clip, store, projectId) => {
        const clipPath = await store.localPath(clip)
        const dir = await mkdtemp(join(tmpdir(), 'duanju-mute-'))
        const out = join(dir, 'muted.mp4')

        // Silent, not audioless: a concat list whose members disagree about
        // having an audio stream loses audio on the ones that do.
        await runOrThrow(
          bin,
          [
            '-y', '-hide_banner', '-loglevel', 'error',
            '-i', clipPath,
            '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-map', '0:v', '-map', '1:a',
            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
            '-shortest',
            out,
          ],
          { timeoutMs: 0, log: deps.log },
        )

        return store.put(new Uint8Array(await readFile(out)), {
          kind: 'clip',
          mime: 'video/mp4',
          projectId,
          label: 'muted-clip',
        })
      },

      mixVoice: async (clip, voice, opts, store, projectId) => {
        const clipPath = await store.localPath(clip)
        const voicePath = await store.localPath(voice)
        const clipSeconds = await probeSeconds(clipPath)
        const voiceSeconds = await probeSeconds(voicePath)
        const dir = await mkdtemp(join(tmpdir(), 'duanju-voice-'))
        const out = join(dir, 'voiced.mp4')

        const hasAudio = await streamExists(probeBin, clipPath, 'a')

        // A line that outlasts its picture is a real production problem, so it
        // is reported rather than papered over. Padding is opt-in because
        // freezing the last frame to fit dialogue is a directorial choice.
        if (voiceSeconds > clipSeconds + 0.25) {
          deps.log.warn(
            `post: voice runs ${voiceSeconds.toFixed(1)}s over a ${clipSeconds.toFixed(1)}s shot` +
              (opts.padToVoice ? ' — holding the last frame to cover it' : ' — voice will be cut off'),
          )
        }

        const voiceChain = `[1:a]volume=${opts.voiceGainDb}dB,aresample=async=1[v]`
        const filter = hasAudio
          ? `[0:a]volume=${opts.bedGainDb}dB[bed];${voiceChain};[bed][v]amix=inputs=2:duration=first:dropout_transition=0[a]`
          : `${voiceChain};[v]anull[a]`

        // -shortest alone would cut the picture to the voice; pad instead when
        // asked, and otherwise let the picture rule.
        const videoArgs = opts.padToVoice
          ? ['-vf', 'tpad=stop_mode=clone:stop_duration=30', '-t', String(Math.max(clipSeconds, voiceSeconds))]
          : ['-t', String(clipSeconds)]

        await runOrThrow(
          bin,
          [
            '-y', '-hide_banner', '-loglevel', 'error',
            '-i', clipPath,
            '-i', voicePath,
            '-filter_complex', filter,
            '-map', '0:v:0', '-map', '[a]',
            ...videoArgs,
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '160k',
            out,
          ],
          { timeoutMs: 0, log: deps.log },
        )

        const bytes = new Uint8Array(await readFile(out))
        return store.put(bytes, {
          kind: 'clip',
          mime: 'video/mp4',
          projectId,
          label: `${clip.id}-voiced`,
          extra: { voicedFrom: clip.id, voice: voice.id },
        })
      },

      overlayCards: async (video, cards, store, projectId) => {
        if (cards.length === 0) return video
        const videoPath = await store.localPath(video)
        const dir = await mkdtemp(join(tmpdir(), 'duanju-cards-'))
        const out = join(dir, 'carded.mp4')
        const runtime = await probeSeconds(videoPath)

        // One pass for every card. Compositing them one at a time would
        // re-encode the picture once per character, and generation loss on a
        // 9:16 cut is visible by the third pass.
        const inputs: string[] = ['-i', videoPath]
        const steps: string[] = []
        let last = '[0:v]'

        for (const [i, card] of cards.entries()) {
          const path = await store.localPath(card.image)
          // A still image is one frame; without -loop it has already ended by
          // the time the overlay window opens, and nothing appears.
          inputs.push('-loop', '1', '-framerate', '25', '-t', String(runtime), '-i', path)

          const fadeOut = Math.max(card.startSeconds, card.endSeconds - card.fadeSeconds)
          steps.push(
            `[${i + 1}:v]format=rgba,` +
              `fade=t=in:st=${card.startSeconds.toFixed(3)}:d=${card.fadeSeconds}:alpha=1,` +
              `fade=t=out:st=${fadeOut.toFixed(3)}:d=${card.fadeSeconds}:alpha=1[c${i}]`,
          )
          const x = card.side === 'left' ? String(card.marginPx) : `W-w-${card.marginPx}`
          const label = i === cards.length - 1 ? '[v]' : `[s${i}]`
          steps.push(
            `${last}[c${i}]overlay=x=${x}:y=(H-h)/2:` +
              `enable='between(t,${card.startSeconds.toFixed(3)},${card.endSeconds.toFixed(3)})'${label}`,
          )
          last = `[s${i}]`
        }

        deps.log.info(`post/ffmpeg: compositing ${cards.length} intro card(s) in one pass`)

        await runOrThrow(
          bin,
          [
            '-y', '-hide_banner', '-loglevel', 'error',
            ...inputs,
            '-filter_complex', steps.join(';'),
            '-map', '[v]',
            ...((await streamExists(probeBin, videoPath, 'a')) ? ['-map', '0:a'] : []),
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
            '-c:a', 'copy',
            '-t', String(runtime),
            out,
          ],
          { timeoutMs: 0, log: deps.log },
        )

        return store.put(new Uint8Array(await readFile(out)), {
          kind: 'final',
          mime: 'video/mp4',
          projectId,
          label: 'intro-carded-cut',
        })
      },

      mixMusic: async (video, music, opts, store, projectId) => {
        const videoPath = await store.localPath(video)
        const musicPath = await store.localPath(music)
        const runtime = await probeSeconds(videoPath)
        const dir = await mkdtemp(join(tmpdir(), 'duanju-mix-'))
        const out = join(dir, 'scored.mp4')

        const hasAudio = await streamExists(probeBin, videoPath, 'a')

        // A short cue under a long cut would simply stop; looping is the
        // difference between "scored" and "scored for the first 40 seconds".
        const loop = opts.loop ? ['-stream_loop', '-1'] : []

        const fadeOutStart = Math.max(0, runtime - opts.fadeOutSeconds)
        const musicChain = [
          `atrim=0:${runtime.toFixed(3)}`,
          'asetpts=PTS-STARTPTS',
          `afade=t=in:st=0:d=${opts.fadeInSeconds}`,
          `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${opts.fadeOutSeconds}`,
          `volume=${opts.musicGainDb}dB`,
        ].join(',')

        // Mixing alone leaves the cut wherever the pieces happened to sit —
        // this one landed at -29dB, quiet enough to read as broken. Normalising
        // to the streaming standard (-16 LUFS, -1.5dBTP) makes every episode
        // arrive at the same, audible level regardless of how its shots were
        // voiced.
        const loudness = opts.normaliseLoudness === false ? '' : ',loudnorm=I=-16:TP=-1.5:LRA=11'
        const filter = hasAudio
          ? opts.duckUnderDialogue
            ? // Sidechain compression: the picture's own audio pushes the score
              // down while anyone is speaking, and lets it back up in the gaps.
              `[1:a]${musicChain}[m];[m][0:a]sidechaincompress=threshold=0.03:ratio=12:attack=15:release=500[duck];[duck][0:a]amix=inputs=2:duration=first:dropout_transition=0${loudness}[a]`
            : `[1:a]${musicChain}[m];[m][0:a]amix=inputs=2:duration=first:dropout_transition=0${loudness}[a]`
          : `[1:a]${musicChain}${loudness}[a]`

        if (!hasAudio) {
          deps.log.debug('post/ffmpeg: picture has no audio track; score becomes the only audio')
        }
        deps.log.info(
          `post/ffmpeg: mixing score at ${opts.musicGainDb}dB over ${runtime.toFixed(1)}s${opts.duckUnderDialogue && hasAudio ? ' (ducked)' : ''}`,
        )

        await runOrThrow(
          bin,
          [
            '-y', '-hide_banner', '-loglevel', 'error',
            '-i', videoPath,
            ...loop, '-i', musicPath,
            '-filter_complex', filter,
            '-map', '0:v', '-map', '[a]',
            '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', '192k',
            '-shortest',
            out,
          ],
          { timeoutMs: 0, log: deps.log },
        )

        return store.put(new Uint8Array(await readFile(out)), {
          kind: 'final',
          mime: 'video/mp4',
          projectId,
          label: 'scored-cut',
        })
      },

      buildSubtitles: async (clips, store, projectId) => {
        // Measured, not requested: a model asked for 4s returns 4.096s, and by
        // shot eight those fractions have walked the subtitles off the picture.
        const measured = []
        let offset = 0
        for (const clip of clips) {
          const seconds = await probeSeconds(await store.localPath(clip.ref))
          if (clip.cue?.text?.trim()) {
            // A 60-character line as one cue fills a third of a vertical
            // frame. Long cues split at punctuation into sequential cues,
            // each shown for a share of the clip proportional to its length —
            // nothing is dropped, it just takes turns.
            const parts = splitCueText(clip.cue.text.trim())
            const total = parts.reduce((n, t) => n + t.length, 0)
            let at = offset
            for (const part of parts) {
              const span = seconds * (part.length / total)
              measured.push({
                start: at,
                end: at + span,
                text: part,
                kind: clip.cue.kind,
                speaker: clip.cue.speaker,
              })
              at += span
            }
          }
          offset += seconds
        }

        const srt = buildSrt(measured)
        deps.log.info(
          `post/ffmpeg: ${measured.length} subtitle cue(s) over ${offset.toFixed(1)}s`,
        )
        return store.put(new TextEncoder().encode(srt), {
          kind: 'other',
          mime: 'application/x-subrip',
          projectId,
          label: 'subtitles',
        })
      },

      muteAudio: async (clip, store, projectId) => {
        const src = await store.localPath(clip)
        const dir = await mkdtemp(join(tmpdir(), 'duanju-mute-'))
        const out = join(dir, 'muted.mp4')

        // The silent track MUST match the source's sample rate and channel
        // count. The concat demuxer reads stream parameters from the first
        // segment and reinterprets every later one against them, so a 48kHz
        // silence spliced between 32kHz clips makes the rest of the reel play
        // fast and then run out of samples — audible as "sped-up, then silent".
        const probed = await run(
          bin.replace(/ffmpeg$/, 'ffprobe'),
          [
            '-v', 'quiet',
            '-select_streams', 'a:0',
            '-show_entries', 'stream=sample_rate,channels',
            '-of', 'csv=p=0',
            src,
          ],
          { timeoutMs: 30_000, log: deps.log },
        )
        const [rateText, channelsText] = probed.stdout.trim().split(',')
        const sampleRate = Number(rateText) > 0 ? Number(rateText) : 48000
        const channels = Number(channelsText) === 1 ? 'mono' : 'stereo'

        // Video is stream-copied — this must not re-encode the picture just to
        // drop a soundtrack. A generated silent track keeps every segment's
        // stream layout identical, which the concat demuxer requires.
        await runOrThrow(
          bin,
          [
            '-y', '-hide_banner', '-loglevel', 'error',
            '-i', src,
            '-f', 'lavfi', '-i', `anullsrc=channel_layout=${channels}:sample_rate=${sampleRate}`,
            '-map', '0:v', '-map', '1:a',
            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
            '-shortest',
            out,
          ],
          { timeoutMs: 0, log: deps.log },
        )

        return store.put(new Uint8Array(await readFile(out)), {
          kind: 'clip',
          mime: 'video/mp4',
          projectId,
          label: `${clip.meta?.label ?? clip.id}-muted`,
          extra: { mutedFrom: clip.id },
        })
      },

      burnSubtitles: async (video, srt, style, store, projectId) => {
        const videoPath = await store.localPath(video)
        const srtPath = await store.localPath(srt)
        const dir = await mkdtemp(join(tmpdir(), 'duanju-subs-'))
        const out = join(dir, 'subtitled.mp4')

        // Hardsub needs libass, and plenty of ffmpeg builds ship without it —
        // including Homebrew's default. Detect it once rather than letting the
        // run die on "No such filter: 'subtitles'" after the picture is paid for.
        if (!(await hasSubtitlesFilter(bin))) {
          // No libass, but subtitles must still be IN the picture — a soft
          // mov_text track is invisible on every short-drama feed. Pillow
          // rasterises each cue and ffmpeg composites them with plain
          // `overlay`, which every build has. The text itself is typeset, not
          // generated, so it is exact by construction.
          deps.log.info(
            'post/ffmpeg: no libass in this ffmpeg — burning subtitles via Pillow overlay instead',
          )
          const burned = await burnViaOverlay({
            bin,
            videoPath,
            srtText: new TextDecoder().decode(await readFile(srtPath)),
            style,
            out,
            log: deps.log,
          })
          if (burned) {
            return store.put(new Uint8Array(await readFile(out)), {
              kind: 'final',
              mime: 'video/mp4',
              projectId,
              label: 'subtitled-cut',
              extra: { subtitleMode: 'overlay' },
            })
          }

          deps.log.warn(
            'post/ffmpeg: Pillow overlay failed too — falling back to a soft mov_text track.',
          )
          await runOrThrow(
            bin,
            [
              '-y', '-hide_banner', '-loglevel', 'error',
              '-i', videoPath,
              '-i', srtPath,
              '-map', '0', '-map', '1',
              '-c', 'copy', '-c:s', 'mov_text',
              out,
            ],
            { timeoutMs: 0, log: deps.log },
          )

          return store.put(new Uint8Array(await readFile(out)), {
            kind: 'final',
            mime: 'video/mp4',
            projectId,
            label: 'soft-subtitled-cut',
            extra: { subtitleMode: 'soft' },
          })
        }

        // ffmpeg parses the filter string itself, so a path with a colon or a
        // comma in it would be read as more filter arguments. `filename=` is
        // spelled out because newer builds reject the positional shorthand.
        const escaped = srtPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'")
        const styleParts = [
          `FontSize=${style.fontSize}`,
          `MarginV=${style.marginVertical}`,
          `PrimaryColour=${toAssColour(style.primaryColour)}`,
          `OutlineColour=${toAssColour(style.outlineColour)}`,
          'BorderStyle=1',
          'Outline=2',
          'Shadow=0',
          'Alignment=2',
          ...(style.fontName ? [`FontName=${style.fontName}`] : []),
        ].join(',')

        deps.log.info(`post/ffmpeg: burning subtitles (size ${style.fontSize})`)

        await runOrThrow(
          bin,
          [
            '-y', '-hide_banner', '-loglevel', 'error',
            '-i', videoPath,
            '-vf', `subtitles=filename='${escaped}':force_style='${styleParts}'`,
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
            '-c:a', 'copy',
            out,
          ],
          { timeoutMs: 0, log: deps.log },
        )

        return store.put(new Uint8Array(await readFile(out)), {
          kind: 'final',
          mime: 'video/mp4',
          projectId,
          label: 'subtitled-cut',
          extra: { subtitleMode: 'burned' },
        })
      },
    }
  },
})

/** Cached: shelling out to `-filters` on every call would be silly. */
let subtitlesFilterAvailable: boolean | undefined

export const hasSubtitlesFilter = async (bin: string): Promise<boolean> => {
  if (subtitlesFilterAvailable !== undefined) return subtitlesFilterAvailable
  try {
    const result = await runOrThrow(bin, ['-hide_banner', '-filters'], { timeoutMs: 30_000 })
    subtitlesFilterAvailable = /^\s*\S+\s+subtitles\s/m.test(result.stdout)
  } catch {
    subtitlesFilterAvailable = false
  }
  return subtitlesFilterAvailable
}

const streamExists = async (
  probeBin: string,
  path: string,
  kind: 'a' | 'v',
): Promise<boolean> => {
  const result = await runOrThrow(
    probeBin,
    ['-v', 'error', '-select_streams', kind, '-show_entries', 'stream=index', '-of', 'json', path],
    { timeoutMs: 60_000 },
  )
  const parsed = parseJsonStdout<{ streams?: readonly unknown[] }>(result.stdout, 'ffprobe')
  return (parsed.streams?.length ?? 0) > 0
}

/** `#RRGGBB` → libass `&HAABBGGRR`, which is byte-reversed and alpha-first. */
const toAssColour = (hex: string): string => {
  const clean = hex.replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '&H00FFFFFF'
  const r = clean.slice(0, 2)
  const g = clean.slice(2, 4)
  const b = clean.slice(4, 6)
  return `&H00${b}${g}${r}`.toUpperCase()
}

export { toAssColour }

/** Exposed for the writer that needs a temp file next to the video. */

// ─── hardsub without libass ────────────────────────────────────────────────

interface SrtCue {
  readonly start: number
  readonly end: number
  readonly text: string
  /** The cue was marked <i> — narration, in this pipeline's SRT. */
  readonly italic: boolean
}

const srtTime = (t: string): number => {
  const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(t)
  if (!m) return 0
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000
}

export const parseSrt = (srt: string): readonly SrtCue[] =>
  srt
    .replace(/\r/g, '')
    .split(/\n\n+/)
    .flatMap((block) => {
      const lines = block.trim().split('\n')
      const timing = lines.find((l) => l.includes('-->'))
      if (!timing) return []
      const [from, to] = timing.split('-->').map((x) => x.trim())
      const raw = lines
        .slice(lines.indexOf(timing) + 1)
        .join('\n')
        .trim()
      // SRT markup is instructions to a renderer, not words. libass would
      // honour <i>; Pillow would paint the angle brackets, so it is stripped
      // here and carried as a flag for the renderer to style narration by.
      const italic = /<i>/.test(raw)
      const text = raw.replace(/<\/?[a-z]+>/g, '').trim()
      if (!text || !from || !to) return []
      return [{ start: srtTime(from), end: srtTime(to), text, italic }]
    })

/**
 * Longest text one on-screen cue may carry. Beyond it, the cue takes turns.
 *
 * 32 CJK glyphs is two comfortable lines at the default size on a 720-wide
 * vertical frame; three-plus lines start hiding the picture the subtitle is
 * supposed to serve.
 */
const MAX_CUE_CHARS = 32

export const splitCueText = (text: string): readonly string[] => {
  if (text.length <= MAX_CUE_CHARS) return [text]
  // Split at sentence punctuation first; greedily refill so pieces stay as
  // close to the cap as possible without crossing it.
  const atoms = text.split(/(?<=[。！？；!?;，,])/).filter((a) => a.length > 0)
  const parts: string[] = []
  let current = ''
  for (const atom of atoms) {
    if (current && current.length + atom.length > MAX_CUE_CHARS) {
      parts.push(current)
      current = atom
    } else {
      current += atom
    }
  }
  if (current) parts.push(current)
  // An atom longer than the cap (no punctuation at all) is hard-wrapped.
  return parts.flatMap((part) =>
    part.length <= MAX_CUE_CHARS
      ? [part]
      : Array.from({ length: Math.ceil(part.length / MAX_CUE_CHARS) }, (_v, i) =>
          part.slice(i * MAX_CUE_CHARS, (i + 1) * MAX_CUE_CHARS),
        ),
  )
}

/** Fonts that hold CJK glyphs, most specific first. */
const CJK_FONTS = [
  '/System/Library/Fonts/STHeiti Medium.ttc',
  '/System/Library/Fonts/PingFang.ttc',
  '/System/Library/Fonts/Hiragino Sans GB.ttc',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
]

/**
 * Rasterises every cue with Pillow and composites the strips with `overlay`.
 *
 * This is the hardsub path for ffmpeg builds without libass (Homebrew's
 * bottle among them): the glyphs are typeset by Pillow — deterministic, full
 * CJK — and ffmpeg only places pixels, a filter every build ships. One pass,
 * one re-encode, same as the libass route.
 */
const burnViaOverlay = async (args: {
  bin: string
  videoPath: string
  srtText: string
  style: SubtitleStyle
  out: string
  log: Logger
}): Promise<boolean> => {
  const cues = parseSrt(args.srtText)
  if (cues.length === 0) return false

  const probed = await run(args.bin.replace(/ffmpeg$/, 'ffprobe'), [
    '-v', 'quiet',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'csv=p=0',
    args.videoPath,
  ], { timeoutMs: 30_000, log: args.log })
  const [width, height] = probed.stdout.trim().split(',').map(Number)
  if (!width || !height) return false

  const dir = await mkdtemp(join(tmpdir(), 'duanju-hardsub-'))
  const script = join(dir, 'cues.py')
  await writeFile(script, CUE_SCRIPT, 'utf8')

  const render = await run('python3', [script], {
    timeoutMs: 120_000,
    log: args.log,
    stdin: `${JSON.stringify({
      dir,
      width,
      // Font size in the style is spoken in libass points on a 720-wide
      // canvas; scale to actual pixels so both burn paths look alike.
      fontPx: Math.round((args.style.fontSize / 22) * (width / 14)),
      fonts: CJK_FONTS,
      maxLines: 2,
      fill: args.style.primaryColour,
      // CJK has no meaningful italic; narration reads as narration through a
      // warm off-white instead, matching the intro cards' parchment tone.
      narrationFill: '#F0E4C0',
      stroke: args.style.outlineColour,
      cues: cues.map((c) => ({ text: c.text, narration: c.italic })),
    })}\n`,
  })
  if (render.code !== 0) {
    args.log.warn(`post/ffmpeg: cue rasteriser failed: ${render.stderr.slice(0, 300)}`)
    return false
  }

  // One input per cue strip, all placed bottom-centre in their window.
  const inputs: string[] = ['-i', args.videoPath]
  const filters: string[] = []
  let chain = '[0:v]'
  cues.forEach((cue, i) => {
    inputs.push(
      '-loop', '1',
      '-framerate', '30',
      '-t', Math.max(cue.end - cue.start, 0.1).toFixed(3),
      '-i', join(dir, `cue-${i}.png`),
    )
    const next = i === cues.length - 1 ? '[v]' : `[s${i}]`
    filters.push(
      `${chain}[${i + 1}:v]overlay=(W-w)/2:H-h-${args.style.marginVertical}:enable='between(t,${cue.start.toFixed(3)},${cue.end.toFixed(3)})'${next}`,
    )
    chain = `[s${i}]`
  })

  const result = await run(args.bin, [
    '-y', '-hide_banner', '-loglevel', 'error',
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[v]', '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    '-c:a', 'copy',
    args.out,
  ], { timeoutMs: 0, log: args.log })
  if (result.code !== 0) {
    args.log.warn(`post/ffmpeg: overlay burn failed: ${result.stderr.slice(0, 300)}`)
    return false
  }
  return true
}

/**
 * Renders each cue as a transparent full-width strip, text centred with a
 * stroke, wrapping at the frame's safe width. JSON in on stdin, PNGs out.
 */
const CUE_SCRIPT = String.raw`
import json, sys, os
from PIL import Image, ImageDraw, ImageFont

spec = json.loads(sys.stdin.readline())
font = None
for path in spec["fonts"]:
    if os.path.exists(path):
        try:
            font = ImageFont.truetype(path, spec["fontPx"])
            break
        except OSError:
            continue
if font is None:
    print("FONT_ERROR", file=sys.stderr)
    sys.exit(1)

W = spec["width"]
safe = int(W * spec.get("safeRatio", 0.78))
max_lines = spec.get("maxLines", 2)
font_path = next(p for p in spec["fonts"] if os.path.exists(p))

def load(px):
    return ImageFont.truetype(font_path, px)

def wrap(text, draw, fnt):
    lines, line = [], ""
    for ch in text.replace("\n", ""):
        probe = line + ch
        if draw.textlength(probe, font=fnt) > safe and line:
            lines.append(line); line = ch
        else:
            line = probe
    if line: lines.append(line)
    return lines or [""]

def fit(text, draw, px):
    # A cue must fit max_lines; type shrinks (never below 60%) before words
    # would ever be dropped — losing dialogue is worse than smaller type.
    floor = int(px * 0.6)
    while px > floor:
        fnt = load(px)
        lines = wrap(text, draw, fnt)
        if len(lines) <= max_lines:
            return fnt, lines, px
        px = int(px * 0.88)
    fnt = load(px)
    return fnt, wrap(text, draw, fnt), px

probe_img = Image.new("RGBA", (W, 10))
probe_draw = ImageDraw.Draw(probe_img)
for i, cue in enumerate(spec["cues"]):
    text = cue["text"]
    fill = spec["narrationFill"] if cue["narration"] else spec["fill"]
    fnt, lines, px = fit(text, probe_draw, spec["fontPx"])
    stroke = max(2, px // 12)
    lh = px + stroke * 2 + 6
    H = lh * len(lines) + 8
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for j, ln in enumerate(lines):
        w = d.textlength(ln, font=fnt)
        d.text(((W - w) / 2, 4 + j * lh), ln, font=fnt,
               fill=fill, stroke_width=stroke, stroke_fill=spec["stroke"])
    img.save(os.path.join(spec["dir"], f"cue-{i}.png"))
print(json.dumps({"ok": True, "count": len(spec["cues"])}))
`

export const writeTemp = async (dir: string, name: string, body: string): Promise<string> => {
  const path = join(dir, name)
  await writeFile(path, body, 'utf8')
  return path
}
