import { z } from 'zod'
import { stateError } from '../../kernel/errors.js'
import { idempotencyKey } from '../../kernel/idem.js'
import { definePlugin } from '../../kernel/registry.js'
import { mapPool } from '../../lib/pool.js'
import { joinPrompt, maybeLoadProfile } from '../../lib/profile.js'
import {
  DEFAULT_CASTING,
  castForWardrobe,
  findDuplicateLooks,
  findIdentityLeaks,
} from '../../lib/wardrobe.js'
import { billedGenerate, summarize } from './shared.js'
import type { StagePort } from '../../kernel/ports.js'
import type { AssetRef, Character, WardrobeLook } from '../../kernel/types.js'

/**
 * Dresses the leads: several outfits per character, one face.
 *
 * The requirement pulls in two directions — the clothes must vary, everything
 * else must not — and the resolution is the source skill's Type E rule: a
 * variant is only safe when the brief *states* which variables move and which
 * are pinned. So each generation carries the confirmed `@base` as its
 * reference image (which puts the libtv adapter into image-to-image), a LOCKED
 * clause naming face, hair, age and build, a CHANGED clause naming garments
 * only, and negatives for the specific failure — a different actor wearing the
 * right coat.
 *
 * The looks themselves come from the story, not from invention. An LLM reads
 * the plan and episodes and proposes outfits the character is actually seen
 * in; a screenplay that already lists them is used as-is and no LLM is called.
 *
 * Two checks run before anything is paid for, because both failures are
 * invisible in the output until you compare images side by side:
 *
 *  - **Identity leakage.** A look that re-describes the face or hair is
 *    competing with the reference image, and the reference does not always
 *    win. Those phrases are stripped and reported.
 *  - **Near-duplicates.** Three outfits that share most of their vocabulary
 *    produce three images that share most of their pixels. Paying three times
 *    for that is worse than having asked for one.
 *
 * Leads only. Four outfits for a character with two lines is money spent on
 * something nobody will notice.
 *
 * Options:
 *   looksPerLead   default 3
 *   leads          character names to dress, overriding billing
 *   skip           names never to dress
 *   fallbackLeads  how many to take when nobody is billed, default 1
 *   cost           ledger units per image, default 1
 *   profile        prompt profile supplying the locked/changed clauses
 */

const looksSchema = z.object({
  looks: z
    .array(
      z.object({
        label: z.string().min(1).describe('中文短标签，如「常服」「夜行衣」'),
        description: z
          .string()
          .min(1)
          .describe('English description of the GARMENTS ONLY — no face, hair, age or build'),
        occasion: z.string().optional().describe('剧情中何时穿这身'),
      }),
    )
    .min(1),
})

const SYSTEM = `你是短剧的服装指导。输出严格 JSON，无解释、无代码围栏。
description 必须是英文，且**只描述衣物**：廓形、层次、面料、颜色、配饰、鞋。
绝对不要写脸、五官、发型、年龄、身材——那些由角色基准图锁定，你重复描述会把人写成另一个人。
每套之间要有真实差异（场合、材质、色调、层次），不要三套都是「深色长袍」。`

export default definePlugin<StagePort>({
  port: 'stage',
  name: 'wardrobe',
  create: () => ({
    name: 'wardrobe',
    id: 'wardrobe',
    needs: ['refs'],

    run: async (ctx) => {
      const { project, ports, log } = ctx
      const cost = numberOption(ctx.options['cost'], 1)
      const looksPerLead = Math.max(1, numberOption(ctx.options['looksPerLead'], 3))
      const limit = Math.min(ctx.concurrency['refs'] ?? 3, ports.image.caps.maxConcurrency)

      const profile = await maybeLoadProfile(
        process.cwd(),
        typeof ctx.options['profileDir'] === 'string'
          ? ctx.options['profileDir']
          : './prompts/profiles',
        ctx.options['profile'] ?? 'photoreal-drama',
      )
      const wardrobeStyle = profile?.characterWardrobe

      const casting = castForWardrobe(project.characters, {
        ...DEFAULT_CASTING,
        leadNames: stringList(ctx.options['leads']),
        skipNames: stringList(ctx.options['skip']),
        fallbackLeads: numberOption(ctx.options['fallbackLeads'], DEFAULT_CASTING.fallbackLeads),
      })
      for (const note of casting.notes) log.warn(`wardrobe: ${note}`)

      const dressable = casting.leads.filter((c) => c.refImage)
      const undressable = casting.leads.filter((c) => !c.refImage)
      for (const character of undressable) {
        // Inventing a second face from text is exactly what the base exists to
        // prevent, so a lead without one waits rather than being guessed at.
        log.warn(`wardrobe: ${character.name} has no confirmed @base; skipped`)
      }
      if (dressable.length === 0) {
        log.info('wardrobe: nobody to dress')
        return { kind: 'ok', project }
      }

      const proposals = new Map<string, readonly WardrobeLook[]>()
      for (const character of dressable) {
        proposals.set(character.id, await propose(character, looksPerLead, ctx, log))
      }

      // Flatten to one job per image so the pool fills evenly: one lead with
      // four looks should not wait behind another lead's four.
      const jobs = dressable.flatMap((character) =>
        (proposals.get(character.id) ?? [])
          .filter((look) => !look.image)
          .map((look) => ({ character, look })),
      )
      if (jobs.length === 0) {
        log.info('wardrobe: every look is already rendered')
        return { kind: 'ok', project }
      }
      log.info(
        `wardrobe: ${jobs.length} look(s) across ${dressable.length} lead(s) — ${dressable
          .map((c) => c.name)
          .join(', ')}`,
      )

      const results = await mapPool(jobs, limit, async ({ character, look }) => {
        const base = character.refImage as AssetRef
        const prompt = joinPrompt(
          profile?.anchors.characterBase,
          wardrobeStyle?.spec ?? 'the same character in a different outfit, full body on white',
          `LOCKED: ${wardrobeStyle?.locked ?? 'identical face, hair, age and build to the attached reference'}`,
          `CHANGED: ${wardrobeStyle?.changed ?? 'only the garments'}`,
          look.description,
          project.plan?.styleGuide,
        )
        const negativePrompt =
          joinPrompt(
            profile?.negatives.shared,
            profile?.negatives.photoreal,
            profile?.negatives.characterBase,
            wardrobeStyle?.negatives,
          ) || undefined

        const key = idempotencyKey('wardrobe', `${character.id}-${look.id}`, {
          prompt,
          ratio: project.ratio,
          base: base.id,
        })

        const image = await billedGenerate({
          ports,
          log,
          idempotencyKey: key,
          cost,
          reason: `wardrobe ${character.name} / ${look.label}`,
          meta: {
            kind: 'character-ref',
            projectId: project.id,
            label: `${character.name} ${look.label}`,
            extra: { characterId: character.id, lookId: look.id },
          },
          produce: () =>
            ports.image.generate({
              prompt,
              negativePrompt,
              // The base is the identity input, which is what makes this a
              // costume change rather than a new character.
              refs: [base],
              ratio: project.ratio,
              idempotencyKey: key,
              label: `wardrobe-${character.id}-${look.id}`,
            }),
        })
        return { characterId: character.id, lookId: look.id, image }
      })

      const rendered = new Map<string, AssetRef>()
      const failures: { subject: string; error: unknown }[] = []
      results.forEach((settled, index) => {
        const job = jobs[index]
        if (!job) return
        if (settled.ok) rendered.set(`${job.character.id}/${job.look.id}`, settled.value.image)
        else failures.push({ subject: `${job.character.name}/${job.look.label}`, error: settled.error })
      })

      summarize(log, 'wardrobe', jobs.length, failures)
      ctx.emit('wardrobe', { rendered: rendered.size })

      return {
        kind: 'ok',
        project: {
          ...project,
          characters: project.characters.map((c): Character => {
            const looks = proposals.get(c.id)
            if (!looks) return c
            return {
              ...c,
              wardrobe: looks.map((look) => ({
                ...look,
                image: look.image ?? rendered.get(`${c.id}/${look.id}`),
              })),
            }
          }),
          updatedAt: new Date().toISOString(),
        },
      }
    },
  }),
})

/**
 * Where the outfits come from.
 *
 * A screenplay that already lists them is authoritative and costs no LLM call.
 * Otherwise the story is read for what this character is actually seen wearing
 * — inventing outfits from nothing produces a fashion lookbook rather than a
 * costume plan.
 */
const propose = async (
  character: Character,
  count: number,
  ctx: Parameters<StagePort['run']>[0],
  log: { warn(msg: string): void; info(msg: string): void },
): Promise<readonly WardrobeLook[]> => {
  const existing = character.wardrobe ?? []
  if (existing.length >= count) {
    return existing.map((look, i) => sanitise(look, i, character, log))
  }

  const { project } = ctx
  const result = await ctx.ports.llm.complete({
    purpose: 'wardrobe',
    system: SYSTEM,
    schema: looksSchema,
    messages: [
      {
        role: 'user',
        content: [
          `剧名：${project.plan?.title ?? project.title}｜题材：${project.plan?.genre ?? ''}`,
          `视觉风格：${project.plan?.styleGuide ?? ''}`,
          `角色：${character.name}${character.epithet ? `（${character.epithet}）` : ''}`,
          `角色外形（已锁定，不要重复描述）：${character.appearance}`,
          '',
          '分集剧情：',
          ...project.episodes.map((e) => `- 第${e.index}集《${e.title}》：${e.synopsis}`),
          '',
          `给出 ${count} 套这个角色在剧中真实会穿的服装。JSON 字段：looks[{label, description, occasion}]`,
        ].join('\n'),
      },
    ],
  })

  const proposed = result.data.looks.slice(0, count).map((raw, i) =>
    sanitise(
      { id: `w${i + 1}`, label: raw.label, description: raw.description, occasion: raw.occasion },
      i,
      character,
      log,
    ),
  )

  for (const problem of findDuplicateLooks(proposed)) {
    log.warn(`wardrobe: ${character.name} — ${problem}`)
  }
  return proposed
}

/** Strips identity language from a look and says so. */
const sanitise = (
  look: WardrobeLook,
  index: number,
  character: Character,
  log: { warn(msg: string): void },
): WardrobeLook => {
  const leaks = findIdentityLeaks(look)
  if (leaks.length > 0) {
    log.warn(
      `wardrobe: ${character.name} / ${look.label} describes ${leaks.join(', ')} — that competes with the base reference and can change the face`,
    )
  }
  return { ...look, id: look.id || `w${index + 1}` }
}

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const stringList = (value: unknown): readonly string[] =>
  Array.isArray(value) ? (value as unknown[]).filter((v): v is string => typeof v === 'string') : []
