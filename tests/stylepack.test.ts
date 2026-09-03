import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createLogger } from '../src/kernel/logger.js'
import {
  buildGradeFilter,
  letterboxFilter,
  listStylePacks,
  loadStylePack,
} from '../src/lib/stylepack.js'
import styleMiddleware from '../src/plugins/middleware/style.js'
import type { GenerateMiddleware, ImageRequest, VideoRequest } from '../src/kernel/ports.js'
import type { PluginDeps } from '../src/kernel/registry.js'

const log = createLogger('silent')
const deps = (cwd: string): PluginDeps => ({
  log,
  cwd,
  load: async () => {
    throw new Error('not used')
  },
})

describe('buildGradeFilter', () => {
  test('a pack asking for nothing yields no filter, so the cut is stream-copied', () => {
    expect(buildGradeFilter(undefined)).toBeUndefined()
    expect(buildGradeFilter({})).toBeUndefined()
  })

  test('colour terms collapse into one eq filter, in a fixed order', () => {
    // Arrange / Act
    const filter = buildGradeFilter({ saturation: 1.35, contrast: 1.1, gamma: 0.94 })

    // Assert — one eq, contrast before saturation before gamma
    expect(filter).toBe('eq=contrast=1.1:saturation=1.35:gamma=0.94')
  })

  test('grain lands after the colour push so contrast does not crush it', () => {
    const filter = buildGradeFilter({ contrast: 1.2, grain: 6 }) ?? ''
    expect(filter.indexOf('eq=')).toBeLessThan(filter.indexOf('noise='))
    expect(filter).toContain('noise=alls=6:allf=t+u')
  })

  test('colour balance maps onto ffmpeg colorbalance keys', () => {
    const filter = buildGradeFilter({
      colorBalance: { shadowsBlue: 0.06, midtonesRed: 0.1, highlightsRed: 0.12 },
    })
    expect(filter).toBe('colorbalance=bs=0.06:rm=0.1:rh=0.12')
  })

  test('the mask is drawn first, before anything touches colour', () => {
    const filter = buildGradeFilter({ aspect: '3:4', saturation: 1.2 }) ?? ''
    expect(filter.startsWith('drawbox=')).toBe(true)
    expect(filter).toContain('eq=saturation=1.2')
  })

  test('extra filters are the last word', () => {
    const filter = buildGradeFilter({ saturation: 1.1, extraFilters: ['hqdn3d=1:1:6:6'] }) ?? ''
    expect(filter.endsWith('hqdn3d=1:1:6:6')).toBe(true)
  })
})

describe('letterboxFilter', () => {
  test('accepts both "w:h" and a plain ratio', () => {
    expect(letterboxFilter('3:4')).toContain('iw/0.75')
    expect(letterboxFilter('2.35')).toContain('iw/2.35')
  })

  test('an unparseable or absent aspect masks nothing', () => {
    expect(letterboxFilter(undefined)).toBeUndefined()
    expect(letterboxFilter('wide')).toBeUndefined()
    expect(letterboxFilter('0')).toBeUndefined()
  })

  test('bars are drawn top and bottom, leaving the frame size alone', () => {
    const filter = letterboxFilter('4:5') ?? ''
    expect(filter.match(/drawbox=/g)).toHaveLength(2)
    expect(filter).not.toContain('scale=')
    expect(filter).not.toContain('crop=')
  })
})

describe('shipped packs', () => {
  test('every pack in prompts/styles loads and validates', async () => {
    const names = await listStylePacks(process.cwd(), './prompts/styles')
    expect(names.length).toBeGreaterThanOrEqual(4)
    for (const name of names) {
      const pack = await loadStylePack(process.cwd(), './prompts/styles', name)
      expect(pack.id).toBe(name)
      expect(pack.label.length).toBeGreaterThan(0)
    }
  })

  test('the two wuxia schools are graded as opposites, not as one look', async () => {
    // Arrange — Shaw is studio colour; King Hu is location naturalism.
    const shaw = await loadStylePack(process.cwd(), './prompts/styles', 'shaw-brothers-wuxia')
    const hu = await loadStylePack(process.cwd(), './prompts/styles', 'king-hu-wuxia')

    // Assert — saturation is the axis they differ on
    expect(shaw.grade?.saturation).toBeGreaterThan(1)
    expect(hu.grade?.saturation).toBeLessThan(1)
    // ...and King Hu cuts shorter than Shaw holds
    expect(hu.pacing?.shotSeconds).toBeLessThan(shaw.pacing?.shotSeconds ?? 99)
  })

  test('the "none" pack is a real opt-out: no grade, no anchors', async () => {
    const pack = await loadStylePack(process.cwd(), './prompts/styles', 'none')
    expect(buildGradeFilter(pack.grade)).toBeUndefined()
    expect(pack.look.image).toBeUndefined()
  })
})

describe('loadStylePack failures', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'duanju-styles-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('a missing pack names the ones that do exist', async () => {
    await writeFile(join(dir, 'real.json'), JSON.stringify({ id: 'real', label: 'Real' }))
    await expect(loadStylePack('/tmp', dir, 'ghost')).rejects.toThrow(/not found/)
    expect(await listStylePacks('/tmp', dir)).toEqual(['real'])
  })

  test('an unknown field is rejected rather than silently ignored', async () => {
    await writeFile(
      join(dir, 'typo.json'),
      JSON.stringify({ id: 'typo', label: 'Typo', grades: { saturation: 2 } }),
    )
    await expect(loadStylePack('/tmp', dir, 'typo')).rejects.toThrow(/failed validation/)
  })
})

describe('style middleware', () => {
  const imageReq = (prompt: string, negativePrompt?: string): ImageRequest =>
    ({ prompt, negativePrompt, ratio: '9:16' }) as ImageRequest
  const videoReq = (prompt: string): VideoRequest =>
    ({ prompt, mode: 'text2video', ratio: '9:16', seconds: 4 }) as VideoRequest
  const ctx = { project: {}, log } as never

  test('the look anchor leads the image prompt, story second', async () => {
    // Arrange
    const mw = (await styleMiddleware.create(
      { pack: 'shaw-brothers-wuxia', dir: './prompts/styles' },
      deps(process.cwd()),
    )) as GenerateMiddleware
    let seen: ImageRequest | undefined

    // Act
    await mw.image?.(imageReq('林默推开客栈木门'), ctx, async (next) => {
      seen = next as ImageRequest
      return []
    })

    // Assert
    expect(seen?.prompt.startsWith('1970s Shaw Brothers studio wuxia still')).toBe(true)
    expect(seen?.prompt).toContain('林默推开客栈木门')
  })

  test("the pack's negatives join the shot's own, never replace them", async () => {
    const mw = (await styleMiddleware.create(
      { pack: 'shaw-brothers-wuxia', dir: './prompts/styles' },
      deps(process.cwd()),
    )) as GenerateMiddleware
    let seen: ImageRequest | undefined
    await mw.image?.(imageReq('a frame', 'blurry'), ctx, async (next) => {
      seen = next as ImageRequest
      return []
    })
    expect(seen?.negativePrompt).toContain('blurry')
    expect(seen?.negativePrompt).toContain('handheld shake')
  })

  test('motion clauses trail the video prompt, so the action reads first', async () => {
    const mw = (await styleMiddleware.create(
      { pack: 'king-hu-wuxia', dir: './prompts/styles' },
      deps(process.cwd()),
    )) as GenerateMiddleware
    let seen: VideoRequest | undefined
    await mw.video?.(videoReq('侠客跃上竹梢'), ctx, async (next) => {
      seen = next as VideoRequest
      return []
    })
    expect(seen?.prompt.startsWith('侠客跃上竹梢')).toBe(true)
    expect(seen?.prompt).toContain('Peking-opera derived combat')
    expect(seen?.prompt).toContain('the move ends before the eye settles')
  })

  test('the "none" pack passes prompts through untouched', async () => {
    const mw = (await styleMiddleware.create(
      { pack: 'none', dir: './prompts/styles' },
      deps(process.cwd()),
    )) as GenerateMiddleware
    let seen: ImageRequest | undefined
    await mw.image?.(imageReq('a frame'), ctx, async (next) => {
      seen = next as ImageRequest
      return []
    })
    expect(seen?.prompt).toBe('a frame')
  })

  test('image:false leaves stills alone while video is still styled', async () => {
    const mw = (await styleMiddleware.create(
      { pack: 'shaw-brothers-wuxia', dir: './prompts/styles', image: false },
      deps(process.cwd()),
    )) as GenerateMiddleware
    expect(mw.image).toBeUndefined()
    expect(mw.video).toBeDefined()
  })
})
