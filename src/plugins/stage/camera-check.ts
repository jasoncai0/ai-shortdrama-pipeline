import { definePlugin } from '../../kernel/registry.js'
import { judgeCamera, loadCameraGrammar, setupKey } from '../../lib/camera.js'
import type { StagePort } from '../../kernel/ports.js'

/**
 * A free, deterministic lint over the shot list's camera plan.
 *
 * Every problem it reports costs real money to discover downstream: an
 * unrecognised move produces an unpredictable shot, two moves in one request
 * produce the "sudden pan or orbit" failure, and a run of identical setups
 * produces footage that cuts together like a slideshow.
 *
 * Placed after `shots` and before `images`, it turns those into a warning you
 * read in a second instead of a batch you pay for and rewatch.
 *
 * Options:
 *   grammar        vocabulary path, default "./prompts/camera/grammar.json"
 *   maxRepeats     consecutive identical setups tolerated, default 2
 *   failOn         "never" (default) | "problems" — whether findings stop the run
 */
export default definePlugin<StagePort>({
  port: 'stage',
  name: 'camera-check',
  create: () => ({
    name: 'camera-check',
    id: 'camera-check',
    needs: ['shots'],

    run: async (ctx) => {
      const { project, log } = ctx
      const path =
        typeof ctx.options['grammar'] === 'string'
          ? ctx.options['grammar']
          : './prompts/camera/grammar.json'
      const grammar = await loadCameraGrammar(process.cwd(), path)
      const maxRepeats = numberOption(ctx.options['maxRepeats'], 2)
      const failOn = ctx.options['failOn'] === 'problems' ? 'problems' : 'never'

      const findings: string[] = []

      for (const shot of project.shots) {
        for (const problem of judgeCamera(shot.cameraMove, grammar).problems) {
          findings.push(`${shot.id}: ${problem}`)
        }
      }

      // Repetition is judged per episode: shot 1 of episode 2 following the
      // last shot of episode 1 is a cut between scenes, not a flat sequence.
      const byEpisode = new Map<string, typeof project.shots>()
      for (const shot of project.shots) {
        byEpisode.set(shot.episodeId, [...(byEpisode.get(shot.episodeId) ?? []), shot])
      }

      for (const [episodeId, shots] of byEpisode) {
        const ordered = [...shots].sort((a, b) => a.order - b.order)
        let runKey = ''
        let runLength = 0
        let runStart = ''

        for (const shot of ordered) {
          const key = setupKey(shot.shotSize, shot.cameraMove)
          if (key === runKey && key !== '|') {
            runLength += 1
          } else {
            runKey = key
            runLength = 1
            runStart = shot.id
          }
          if (runLength === maxRepeats + 1) {
            findings.push(
              `${episodeId}: ${runLength} consecutive shots share one setup (${shot.shotSize ?? '?'} / ${shot.cameraMove ?? '?'}) from ${runStart} — vary shot size or camera angle`,
            )
          }
        }
      }

      const missing = project.shots.filter((s) => !s.cameraMove?.trim()).length
      if (missing > 0) {
        findings.push(`${missing}/${project.shots.length} shots declare no camera move`)
      }

      if (findings.length === 0) {
        log.info(`camera-check: ${project.shots.length} shots, no findings`)
      } else {
        log.warn(`camera-check: ${findings.length} finding(s)`)
        for (const finding of findings) log.warn(`  ${finding}`)
      }
      ctx.emit('camera-check', { findings })

      if (failOn === 'problems' && findings.length > 0) {
        throw new Error(
          `camera-check found ${findings.length} problem(s). Fix the shot list, or set failOn:"never" to continue.`,
        )
      }

      return { kind: 'ok', project }
    },
  }),
})

const numberOption = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
