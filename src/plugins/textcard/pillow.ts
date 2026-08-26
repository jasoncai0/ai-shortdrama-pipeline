import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { providerError } from '../../kernel/errors.js'
import { definePlugin } from '../../kernel/registry.js'
import { runOrThrow } from '../../lib/proc.js'
import type { TextCardPort, TextCardSpec } from '../../kernel/ports.js'

/**
 * Renders intro cards with Pillow.
 *
 * Text has to be *right*, which rules out generating it: an image model will
 * produce something that looks like 「陈宗之」 and is not. It also rules out
 * ffmpeg's `drawtext` here — this build has no freetype, so ffmpeg cannot draw
 * a glyph at all. Pillow can, and the layout stays entirely under our control.
 *
 * Vertical layout is one glyph per line, which is what CJK titling actually
 * does; there is no vertical text engine involved and none is needed.
 *
 * The script is passed on stdin rather than written to a file so that a card's
 * text — which is story content — never lands on disk outside the asset store.
 *
 * Options:
 *   python   interpreter, default python3
 */

const SCRIPT = String.raw`
import json, sys
from PIL import Image, ImageDraw, ImageFont

spec = json.loads(sys.stdin.readline())
out = spec["out"]

W, H = spec["widthPx"], spec["heightPx"]
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

def rgba(hexstr, alpha=255):
    h = hexstr.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)

try:
    title_font = ImageFont.truetype(spec["fontPath"], spec["titleSizePx"])
    sub_font = ImageFont.truetype(spec["fontPath"], spec["subtitleSizePx"])
except OSError as e:
    print("FONT_ERROR: %s" % e, file=sys.stderr)
    raise SystemExit(2)

title = list(spec["title"])
subtitle = list(spec.get("subtitle") or "")

# Line pitch a little over the glyph box: CJK titling breathes.
tp = int(spec["titleSizePx"] * 1.16)
sp = int(spec["subtitleSizePx"] * 1.25)

pad = int(spec["titleSizePx"] * 0.45)
gap = int(spec["titleSizePx"] * 0.30)
content_h = len(title) * tp + (gap + len(subtitle) * sp if subtitle else 0)
top = max(pad, (H - content_h) // 2)
panel_h = content_h + pad * 2

rule_w = max(3, int(spec["titleSizePx"] * 0.08))
left_edge = 0 if spec["side"] == "left" else W - 1

# Panel first, then the accent rule on the outer edge, then the glyphs.
if spec["panelOpacity"] > 0:
    alpha = int(255 * spec["panelOpacity"])
    x0 = rule_w if spec["side"] == "left" else 0
    x1 = W if spec["side"] == "left" else W - rule_w
    d.rectangle([x0, top - pad, x1, top - pad + panel_h], fill=rgba(spec["panelColour"], alpha))

rx0 = 0 if spec["side"] == "left" else W - rule_w
d.rectangle([rx0, top - pad, rx0 + rule_w, top - pad + panel_h], fill=rgba(spec["accentColour"]))

def draw_column(chars, font, pitch, colour, y, size):
    for ch in chars:
        bbox = d.textbbox((0, 0), ch, font=font)
        cw = bbox[2] - bbox[0]
        # Centre each glyph in the column so a mixed-width string stays aligned.
        x = (W - cw) // 2 - bbox[0]
        d.text((x, y), ch, font=font, fill=colour)
        y += pitch
    return y

y = top
y = draw_column(title, title_font, tp, rgba(spec["titleColour"]), y, spec["titleSizePx"])
if subtitle:
    y += gap
    draw_column(subtitle, sub_font, sp, rgba(spec["subtitleColour"], 235), y, spec["subtitleSizePx"])

img.save(out)
print(json.dumps({"ok": True, "width": W, "height": H}))
`

export default definePlugin<TextCardPort>({
  port: 'textCard',
  name: 'pillow',
  create: (options, deps) => {
    const python = typeof options['python'] === 'string' ? options['python'] : 'python3'

    return {
      name: 'pillow',
      caps: { vertical: true },

      render: async (spec: TextCardSpec, store, projectId, label) => {
        const dir = await mkdtemp(join(tmpdir(), 'duanju-card-'))
        const out = join(dir, 'card.png')
        const scriptPath = join(dir, 'render.py')
        await writeFile(scriptPath, SCRIPT, 'utf8')

        const result = await runOrThrow(python, [scriptPath], {
          timeoutMs: 60_000,
          log: deps.log,
          stdin: `${JSON.stringify({ ...spec, out })}\n`,
        })
        if (result.stderr.includes('FONT_ERROR')) {
          throw providerError(
            `The intro-card font could not be opened: ${spec.fontPath}`,
            'Point introCard.fontPath at a font file that contains the glyphs you need — on macOS, /System/Library/Fonts/STHeiti Medium.ttc.',
          )
        }

        deps.log.debug(`textcard/pillow: ${label} ${spec.widthPx}x${spec.heightPx}`)
        return store.put(new Uint8Array(await readFile(out)), {
          kind: 'other',
          mime: 'image/png',
          projectId,
          label: `intro-${label}`,
          extra: { title: spec.title, side: spec.side },
        })
      },
    }
  },
})
