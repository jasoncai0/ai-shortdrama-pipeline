import { describe, expect, test } from 'vitest'
import plugin from '../src/plugins/stage/music.js'
import type { Project } from '../src/kernel/types.js'

/**
 * Re-cutting the picture invalidates the mix, not the choice of score. The
 * stage used to re-run `find` whenever `scoredCut` was gone — which searched,
 * and on a generating source paid, for a different track than the one already
 * approved for the project. On an account out of compute it failed outright.
 */

const log = { info: () => {}, warn: () => {}, debug: () => {}, error: () => {} }

const track = {
  id: 't1',
  title: '已选的曲子',
  source: 'generated' as const,
  provider: 'libtv',
  seconds: 240,
  licence: { code: 'generated', commercialUse: true, derivativesAllowed: true },
  asset: { id: 'a1', uri: 'file:///score.mp3', mime: 'audio/mpeg' },
}

const runStage = async (project: Partial<Project>, options: Record<string, unknown> = {}) => {
  const calls = { find: 0, mix: 0 }
  const stage = plugin.create({}, { log, cwd: process.cwd() } as never)
  const outcome = await stage.run({
    project: {
      id: 'p1',
      shots: [{ id: 's1', durationSeconds: 5 }],
      finalCut: { id: 'c', uri: 'file:///cut.mp4', mime: 'video/mp4' },
      stageState: {},
      ...project,
    } as unknown as Project,
    options,
    log,
    emit: () => {},
    ports: {
      music: {
        name: 'stub',
        find: async () => {
          calls.find += 1
          return []
        },
      },
      post: {
        mixMusic: async () => {
          calls.mix += 1
          return { id: 'mixed', uri: 'file:///mixed.mp4', mime: 'video/mp4' }
        },
      },
      assetStore: { localPath: async (r: { uri: string }) => r.uri },
    },
  } as never)
  return { outcome, calls }
}

describe('re-scoring an existing project', () => {
  test('a new cut is remixed with the track already chosen — no second search', async () => {
    const { outcome, calls } = await runStage({ music: track } as Partial<Project>)

    expect(calls.find).toBe(0)
    expect(calls.mix).toBe(1)
    expect(outcome.kind).toBe('ok')
    if (outcome.kind === 'ok') {
      expect(outcome.project.scoredCut?.uri).toBe('file:///mixed.mp4')
      // The choice survives the remix; only the mix is new.
      expect(outcome.project.music?.title).toBe('已选的曲子')
    }
  })

  test('with both a track and a scored cut it does nothing at all', async () => {
    const { calls } = await runStage({
      music: track,
      scoredCut: { id: 'sc', uri: 'file:///scored.mp4', mime: 'video/mp4' },
    } as Partial<Project>)

    expect(calls).toEqual({ find: 0, mix: 0 })
  })

  test('overwrite forces a fresh search even when a track exists', async () => {
    await expect(runStage({ music: track } as Partial<Project>, { overwrite: true })).rejects.toThrow(
      /No usable music/,
    )
  })
})
