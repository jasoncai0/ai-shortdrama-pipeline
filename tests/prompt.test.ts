import { describe, expect, test } from 'vitest'
import { buildVars, render } from '../src/plugins/promptStrategy/template.js'
import type { Project, Shot } from '../src/kernel/types.js'

const project: Project = {
  id: 'p1',
  title: 'Rainy Alley',
  kind: 'shortdrama',
  ratio: '9:16',
  idea: 'test',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  plan: {
    title: 'Rainy Alley',
    genre: 'noir thriller',
    logline: 'a courier sees too much',
    mainPlot: 'courier witnesses a murder',
    sellingPoints: ['tense', 'twist'],
    conflicts: ['courier vs killer'],
    styleGuide: 'cinematic neo-noir, teal and orange, 35mm grain',
  },
  episodes: [{ id: 'ep1', index: 1, title: 'Night One', synopsis: 'it begins' }],
  characters: [
    { id: 'ch1', name: 'Lin Mo', appearance: 'late-20s courier, yellow rain jacket, buzzcut' },
    { id: 'ch2', name: 'The Killer', appearance: 'tall figure, black coat, leather gloves' },
  ],
  scenes: [{ id: 'sc1', name: 'Neon Alley', visualDescription: 'wet asphalt alley, neon signage, night' }],
  props: [{ id: 'pr1', name: 'Delivery Box', description: 'insulated yellow delivery box' }],
  shots: [],
  stageState: {},
  adapterState: {},
}

const shot: Shot = {
  id: 'ep1-s01',
  episodeId: 'ep1',
  order: 1,
  durationSeconds: 5,
  plotDescription: 'courier freezes mid-step',
  shotSize: 'medium shot',
  cameraMove: 'slow dolly-in',
  characterAction: 'gripping the delivery box',
  emotion: 'dread',
  lightingAndAtmosphere: 'harsh neon rimlight, rain haze',
  characterIds: ['ch1'],
  sceneId: 'sc1',
  propIds: ['pr1'],
  status: 'draft',
}

describe('buildVars', () => {
  test('resolves referenced entities instead of copying descriptions', () => {
    const vars = buildVars(shot, project)

    expect(vars['characterAppearances']).toBe(
      'Lin Mo: late-20s courier, yellow rain jacket, buzzcut',
    )
    expect(vars['sceneDescription']).toBe('wet asphalt alley, neon signage, night')
    expect(vars['props']).toBe('insulated yellow delivery box')
    expect(vars['styleGuide']).toBe('cinematic neo-noir, teal and orange, 35mm grain')
  })

  test('editing a character propagates to every shot referencing it', () => {
    const restyled: Project = {
      ...project,
      characters: project.characters.map((c) =>
        c.id === 'ch1' ? { ...c, appearance: 'late-20s courier, red poncho, long hair' } : c,
      ),
    }

    expect(buildVars(shot, restyled)['characterAppearances']).toBe(
      'Lin Mo: late-20s courier, red poncho, long hair',
    )
  })

  test('unresolvable references are dropped, not rendered as ids', () => {
    const orphan: Shot = { ...shot, characterIds: ['ch-missing'], sceneId: 'sc-missing' }
    const vars = buildVars(orphan, project)

    expect(vars['characterAppearances']).toBe('')
    expect(vars['sceneDescription']).toBe('')
  })
})

describe('render', () => {
  test('substitutes placeholders', () => {
    expect(render('{{styleGuide}}, {{plotDescription}}', buildVars(shot, project))).toBe(
      'cinematic neo-noir, teal and orange, 35mm grain, courier freezes mid-step',
    )
  })

  test('drops empty segments so no dangling commas reach the model', () => {
    const bare: Shot = { ...shot, shotSize: undefined, emotion: undefined }
    const out = render('{{plotDescription}}, {{shotSize}}, {{emotion}}, {{cameraMove}}', buildVars(bare, project))

    expect(out).toBe('courier freezes mid-step, slow dolly-in')
    expect(out).not.toContain(', ,')
  })

  test('unknown placeholders become empty rather than literal text', () => {
    expect(render('{{nope}}, {{plotDescription}}', buildVars(shot, project))).toBe(
      'courier freezes mid-step',
    )
  })
})
