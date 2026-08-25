import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { providerError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { buildSrt } from '../../lib/srt.js'
import { parseJsonStdout, runOrThrow } from '../../lib/proc.js'
import type { PostPort } from '../../kernel/ports.js'

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

        const filter = hasAudio
          ? opts.duckUnderDialogue
            ? // Sidechain compression: the picture's own audio pushes the score
              // down while anyone is speaking, and lets it back up in the gaps.
              `[1:a]${musicChain}[m];[m][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[duck];[duck][0:a]amix=inputs=2:duration=first:dropout_transition=0[a]`
            : `[1:a]${musicChain}[m];[m][0:a]amix=inputs=2:duration=first:dropout_transition=0[a]`
          : `[1:a]${musicChain}[a]`

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
            measured.push({ start: offset, end: offset + seconds, text: clip.cue.text.trim() })
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

      burnSubtitles: async (video, srt, style, store, projectId) => {
        const videoPath = await store.localPath(video)
        const srtPath = await store.localPath(srt)
        const dir = await mkdtemp(join(tmpdir(), 'duanju-subs-'))
        const out = join(dir, 'subtitled.mp4')

        // Hardsub needs libass, and plenty of ffmpeg builds ship without it —
        // including Homebrew's default. Detect it once rather than letting the
        // run die on "No such filter: 'subtitles'" after the picture is paid for.
        if (!(await hasSubtitlesFilter(bin))) {
          deps.log.warn(
            'post/ffmpeg: this ffmpeg has no libass, so subtitles cannot be burned into the picture.',
          )
          deps.log.warn(
            '  Falling back to a soft mov_text track: players can show it, but it is toggleable and',
          )
          deps.log.warn(
            '  most short-drama feeds will not display it. Install ffmpeg with libass for hardsub.',
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
export const writeTemp = async (dir: string, name: string, body: string): Promise<string> => {
  const path = join(dir, name)
  await writeFile(path, body, 'utf8')
  return path
}
