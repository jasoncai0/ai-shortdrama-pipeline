import type { Shot } from '../kernel/types.js'

/**
 * Deterministic shot-language pass.
 *
 * A screenplay says who speaks and what happens; it almost never says where
 * the camera is. Left alone, every dialogue line became the same shot — one
 * person, 中景, locked off — and a five-minute episode read as a slideshow of
 * talking heads. Two specific failures this pass exists to fix:
 *
 * 1. **Coverage variety.** Sizes and moves rotate with the rhythm of the scene
 *    instead of defaulting: an exchange alternates over-the-shoulder sides,
 *    every third line of a long exchange tightens to a close-up, emotional
 *    lines tighten and go handheld, action beats rotate through lateral and
 *    following moves rather than repeating the last shot's move.
 *
 * 2. **Interaction.** A line spoken *to* someone is a two-person frame. The
 *    listener — the most recent other character on stage in the scene — joins
 *    the shot's cast and composition (foreground back-to-camera in an OTS), so
 *    conversations look like conversations rather than alternating monologues.
 *
 * Deterministic on purpose: same script in, same coverage out, no model in the
 * loop. All vocabulary matches prompts/camera/grammar.json aliases so the
 * camera-grammar middleware expands each move into physical phrasing.
 */

/**
 * Emotional weight strong enough to change the framing.
 *
 * Deliberately narrow: Mandarin dialogue ends in ！and ？constantly, and
 * matching bare punctuation made half the coverage a handheld close-up. Only
 * physical distress verbs and a broken-off scream (——) qualify.
 */
const EMOTIONAL_RE = /哭|喊|吼|怒|泣|嘶|崩溃|跪下?!|扑上|冲进|——$/

/** Moves for beats (non-dialogue), rotated so neighbours never repeat. */
const BEAT_MOVES = ['缓慢推进', '横移左', '手持跟拍', '缓慢拉远', '横移右', '固定机位'] as const

const beat = (shot: Shot): boolean => shot.kind !== 'insert'

interface SceneMemory {
  /** Everyone who has been on camera in this scene so far, most recent last. */
  roster: string[]
  /** Consecutive dialogue lines in the current exchange. */
  exchange: number
  /** Which side the last OTS favoured, so the next reverses. */
  side: 'A' | 'B'
  lastMove: string | undefined
  lastSize: string | undefined
  moveIndex: number
  firstBeatSeen: boolean
}

const remember = (memory: SceneMemory, ids: readonly string[]): void => {
  for (const id of ids) {
    const at = memory.roster.indexOf(id)
    if (at >= 0) memory.roster.splice(at, 1)
    memory.roster.push(id)
  }
}

const listenerFor = (memory: SceneMemory, speaker: string | undefined): string | undefined =>
  [...memory.roster].reverse().find((id) => id !== speaker)

const nextBeatMove = (memory: SceneMemory): string => {
  let move = BEAT_MOVES[memory.moveIndex % BEAT_MOVES.length]!
  if (move === memory.lastMove) {
    memory.moveIndex += 1
    move = BEAT_MOVES[memory.moveIndex % BEAT_MOVES.length]!
  }
  memory.moveIndex += 1
  memory.lastMove = move
  return move
}

const dialogueLanguage = (
  shot: Shot,
  memory: SceneMemory,
): Pick<Shot, 'shotSize' | 'cameraMove' | 'characterIds' | 'plotDescription'> => {
  memory.exchange += 1
  const speaker = shot.characterIds?.[0]
  const listener = listenerFor(memory, speaker)
  const emotional = EMOTIONAL_RE.test(shot.dialogue ?? '')

  // A long exchange needs punctuation: every third line tightens to the face.
  const tight = emotional || memory.exchange % 3 === 0

  if (!listener || tight) {
    // Two identical close-ups back to back read as a stutter: the second one
    // in a row widens back out however it was earned.
    const repeat = tight && memory.lastSize === '特写'
    const size = repeat ? '近景' : tight ? '特写' : '近景'
    const move = emotional && !repeat ? '手持跟拍' : memory.exchange % 2 === 0 ? '缓慢推进' : '固定机位'
    memory.lastMove = move
    memory.lastSize = size
    return {
      shotSize: size,
      cameraMove: move,
      characterIds: shot.characterIds,
      plotDescription: shot.plotDescription,
    }
  }

  // Two people: over-the-shoulder, reversing sides line by line so the
  // exchange cuts back and forth across the axis the way coverage does.
  memory.side = memory.side === 'A' ? 'B' : 'A'
  memory.lastSize = '过肩中景'
  const sideText = memory.side === 'A' ? '画面左侧前景' : '画面右侧前景'
  memory.lastMove = '固定机位'
  return {
    shotSize: '过肩中景',
    cameraMove: '固定机位',
    characterIds: [speaker!, listener],
    plotDescription: `${shot.plotDescription}, 过肩镜头, 听者在${sideText}背对镜头虚化, 说话者面向镜头方向`,
  }
}

/**
 * Rewrites shotSize / cameraMove / characterIds / plotDescription in place of
 * the screenplay's defaults. Inserts (留白/转场空镜) are left exactly as the
 * pacing pass framed them. Returns new shots; never mutates.
 */
export const planShotLanguage = (shots: readonly Shot[]): readonly Shot[] => {
  const memories = new Map<string, SceneMemory>()

  return shots.map((shot) => {
    const key = `${shot.episodeId}:${shot.sceneId ?? ''}`
    let memory = memories.get(key)
    if (!memory) {
      memory = {
        roster: [],
        exchange: 0,
        side: 'B',
        lastMove: undefined,
        lastSize: undefined,
        moveIndex: 0,
        firstBeatSeen: false,
      }
      memories.set(key, memory)
    }

    if (!beat(shot)) return shot

    remember(memory, shot.characterIds ?? [])

    if (shot.dialogue) {
      // An explicit 特写 in the script is the writer directing; keep it.
      if (shot.shotSize === '特写') {
        memory.exchange += 1
        return shot
      }
      return { ...shot, ...dialogueLanguage(shot, memory) }
    }

    memory.exchange = 0

    // The first look at a scene stays an establishing wide.
    if (!memory.firstBeatSeen) {
      memory.firstBeatSeen = true
      memory.lastMove = shot.cameraMove
      return shot
    }

    const cast = shot.characterIds?.length ?? 0
    return {
      ...shot,
      shotSize: cast >= 2 ? '中景' : cast === 1 ? '近景' : '全景',
      cameraMove: nextBeatMove(memory),
    }
  })
}
