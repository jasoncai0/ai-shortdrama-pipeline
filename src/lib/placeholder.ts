import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'

/**
 * Minimal PNG encoder for the stub image adapter — a real, decodable file so
 * downstream tools (ffmpeg, viewers) behave exactly as they would with a
 * provider image. Colour is derived from the seed so distinct shots are
 * visually distinguishable when eyeballing a stub run.
 */
export const pngPlaceholder = (seed: string, size = 64): Uint8Array => {
  const digest = createHash('sha256').update(seed).digest()
  const rgb: readonly [number, number, number] = [
    digest[0] ?? 0,
    digest[1] ?? 0,
    digest[2] ?? 0,
  ]

  // Raw scanlines: one filter byte (0 = None) + RGB triplets per row.
  const stride = size * 3 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * stride
    raw[rowStart] = 0
    for (let x = 0; x < size; x += 1) {
      const p = rowStart + 1 + x * 3
      raw[p] = rgb[0]
      raw[p + 1] = rgb[1]
      raw[p + 2] = rgb[2]
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
}

const chunk = (type: string, body: Buffer): Buffer => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(body.length, 0)
  const typeAndBody = Buffer.concat([Buffer.from(type, 'ascii'), body])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndBody), 0)
  return Buffer.concat([length, typeAndBody, crc])
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (buf: Buffer): number => {
  let c = 0xffffffff
  for (const byte of buf) {
    c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}
