import { z } from 'zod'
import { stateError } from '../../kernel/errors.js'
import { idempotencyKey } from '../../kernel/idem.js'
import { definePlugin } from '../../kernel/registry.js'
import { checkLicence, needsAttribution } from '../../lib/licence.js'
import { billedGenerate } from './shared.js'
import type { MusicBrief, MusicCandidate, StagePort } from '../../kernel/ports.js'
import type { MusicTrack } from '../../kernel/types.js'

/**
 * Picks a score and lays it under the cut.
 *
 * Runs after `export` for a practical reason: the brief needs the real runtime,
 * and a generated cue written for "about 40 seconds" is worth more than one
 * written for a guess. Runs *before* the confirmation gate for a different one:
 * a silent cut is not the thing anyone is being asked to approve.
 *
 * Selection is a judgement over metadata — title, tags, creator, licence — so
 * an LLM makes it, with a deterministic fallback when no LLM is configured.
 * Rejected candidates are kept on the project so a re-pick costs nothing.
 */

const choiceSchema = z.object({
  chosenId: z.string().min(1),
  rationale: z.string().min(1),
})

export default definePlugin<StagePort>({
  port: 'stage',
  name: 'music',
  create: () => ({
    name: 'music',
    id: 'music',
    needs: ['export'],

    run: async (ctx) => {
      const { project, ports, log } = ctx
      const cut = project.finalCut
      if (!cut) {
        throw stateError('music stage requires a finished cut.', 'Run the "export" stage first.')
      }
      if (project.music && project.scoredCut && ctx.options['overwrite'] !== true) {
        log.info('music: already scored')
        return { kind: 'ok', project }
      }

      const runtime = project.shots.reduce((sum, s) => sum + s.durationSeconds, 0)
      const brief: MusicBrief = {
        genre: project.plan?.genre ?? '',
        mood: stringOption(ctx.options['mood'], project.plan?.conflicts?.[0] ?? 'tense'),
        styleGuide: project.plan?.styleGuide ?? '',
        seconds: Math.max(runtime, 10),
        keywords: [
          ...(Array.isArray(ctx.options['keywords'])
            ? (ctx.options['keywords'] as unknown[]).filter((k): k is string => typeof k === 'string')
            : []),
          'instrumental',
          'no vocals',
        ],
      }

      const limit = numberOption(ctx.options['candidates'], 4)
      const found = await ports.music.find(brief, limit)
      if (found.length === 0) {
        throw stateError(
          `No usable music found by "${ports.music.name}".`,
          'Add tracks to the local library, widen the licence policy, or enable a generating source.',
        )
      }

      // Belt and braces: a source may not enforce policy, and an unusable track
      // that reaches the mix is a licensing problem shipped in a deliverable.
      const usable = found.filter((c) => {
        const verdict = checkLicence(c.licence)
        if (!verdict.ok) log.warn(`music: dropping "${c.title}" — ${verdict.reason}`)
        return verdict.ok
      })
      if (usable.length === 0) {
        throw stateError(
          `All ${found.length} candidate(s) failed the licence policy.`,
          'Scoring a video is a commercial derivative work; NC and ND tracks cannot be used.',
        )
      }

      const chosen = await select(usable, brief, ctx, log)
      log.info(`music: "${chosen.candidate.title}" (${chosen.candidate.licence.code}) — ${chosen.rationale}`)

      const cost = numberOption(ctx.options['cost'], chosen.candidate.source === 'generated' ? 3 : 0)
      const key = idempotencyKey('music', project.id, { uri: chosen.candidate.uri })

      const asset = await billedGenerate({
        ports,
        log,
        idempotencyKey: key,
        cost,
        reason: `score ${chosen.candidate.title}`,
        meta: {
          kind: 'other',
          mime: chosen.candidate.mime,
          projectId: project.id,
          label: chosen.candidate.title,
        },
        produce: async () => [
          {
            id: chosen.candidate.id,
            uri: chosen.candidate.uri,
            mime: chosen.candidate.mime,
            meta: { source: chosen.candidate.source, licence: chosen.candidate.licence.code },
          },
        ],
      })

      const track: MusicTrack = {
        id: chosen.candidate.id,
        title: chosen.candidate.title,
        source: chosen.candidate.source,
        provider: ports.music.name,
        seconds: chosen.candidate.seconds,
        creator: chosen.candidate.creator,
        tags: chosen.candidate.tags,
        licence: chosen.candidate.licence,
        asset,
        rationale: chosen.rationale,
      }

      if (needsAttribution(track.licence)) {
        log.warn(`music: this licence requires a credit line in the deliverable:`)
        log.warn(`  ${track.licence.attribution}`)
      }

      const scoredCut = await ports.post.mixMusic(
        cut,
        asset,
        {
          musicGainDb: numberOption(ctx.options['musicGainDb'], -14),
          fadeInSeconds: numberOption(ctx.options['fadeInSeconds'], 1.5),
          fadeOutSeconds: numberOption(ctx.options['fadeOutSeconds'], 2),
          loop: ctx.options['loop'] !== false,
          duckUnderDialogue: ctx.options['duckUnderDialogue'] !== false,
        },
        ports.assetStore,
        project.id,
      )

      ctx.emit('music', { title: track.title, licence: track.licence.code })

      return {
        kind: 'ok',
        project: {
          ...project,
          music: track,
          musicCandidates: usable
            .filter((c) => c.id !== chosen.candidate.id)
            .map((c) => ({ ...toTrack(c, ports.music.name), asset })),
          scoredCut,
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})

/**
 * The LLM sees only metadata, never audio — so the prompt asks it to reason
 * about fit from title, tags and source, and the fallback is honest about
 * being arbitrary rather than dressing itself up as taste.
 */
const select = async (
  candidates: readonly MusicCandidate[],
  brief: MusicBrief,
  ctx: Parameters<StagePort['run']>[0],
  log: { warn(msg: string): void },
): Promise<{ candidate: MusicCandidate; rationale: string }> => {
  const first = candidates[0] as MusicCandidate
  if (candidates.length === 1) {
    return { candidate: first, rationale: 'only usable candidate' }
  }

  try {
    const result = await ctx.ports.llm.complete({
        purpose: "music-select",
      system:
        '你是短剧的音乐监制。只根据给出的元数据（标题、标签、来源、时长）判断哪一条最贴合，' +
        '输出严格 JSON，无解释、无代码围栏。你听不到音频，所以不要假装评价音色。',
      schema: choiceSchema,
      messages: [
        {
          role: 'user',
          content: [
            `题材：${brief.genre}｜情绪：${brief.mood}｜视觉风格：${brief.styleGuide}`,
            `需要覆盖时长：约 ${Math.round(brief.seconds)} 秒`,
            '',
            '候选：',
            ...candidates.map(
              (c, i) =>
                `${i + 1}. id=${c.id}｜《${c.title}》｜来源=${c.source}｜时长=${c.seconds ?? '未知'}s｜标签=${c.tags.join('/') || '无'}`,
            ),
            '',
            'JSON 字段：chosenId（必须是上面某个 id）, rationale（一句话，中文）',
          ].join('\n'),
        },
      ],
    })

    const picked = candidates.find((c) => c.id === result.data.chosenId)
    if (picked) return { candidate: picked, rationale: result.data.rationale }
    log.warn(`music: selector returned unknown id "${result.data.chosenId}", falling back`)
  } catch (error) {
    log.warn(`music: selector unavailable (${String(error)}), falling back`)
  }

  return {
    candidate: first,
    rationale: 'fallback: first usable candidate, not a judgement of fit',
  }
}

const toTrack = (c: MusicCandidate, provider: string): Omit<MusicTrack, 'asset'> => ({
  id: c.id,
  title: c.title,
  source: c.source,
  provider,
  seconds: c.seconds,
  creator: c.creator,
  tags: c.tags,
  licence: c.licence,
})

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const stringOption = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback
