/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import fontkit from '@pdf-lib/fontkit'
import { expect, it } from 'vitest'

it.each([
  ['NotoSans-Regular.ttf', 'Invoice 42.00 \u00e9 \u1ec7 \u0416'],
  [
    'NotoSansArabic-Regular.ttf',
    '\u0645\u0631\u062d\u0628\u0627 \u0628\u0627\u0644\u0639\u0627\u0644\u0645 2026',
  ],
  [
    'TranslationCJK-Regular.ttf',
    '\u5b63\u5ea6\u62a5\u544a \u4f60\u597d\u4e16\u754c \u53ce\u5165 \u3042 \ud55c 42.00',
  ],
  ['TranslationSymbols-Regular.ttf', ''],
  [
    'TranslationEmoji-Regular.ttf',
    String.fromCodePoint(0x1f30d, 0x1f469, 0x200d, 0x1f4bb, 0x2764, 0xfe0f),
  ],
])(
  'preserves every glyph outline when subsetting bundled font %s',
  async (file, sample) => {
    const bytes = new Uint8Array(
      await readFile(path.resolve('public/static/translation-fonts', file))
    )
    const font = fontkit.create(bytes)
    const text =
      sample ||
      font.characterSet
        .filter((cp) => cp >= 0x2500)
        .slice(0, 24)
        .map((cp) => String.fromCodePoint(cp))
        .join('')
    const glyphs = font.layout(text).glyphs
    const subset = font.createSubset()
    const pairs = glyphs.map((glyph) => ({
      original: glyph,
      id: subset.includeGlyph(glyph),
    }))
    const encoded = await new Promise<Uint8Array>((resolve) => {
      const chunks: Uint8Array[] = []
      subset
        .encodeStream()
        .on('data', (chunk) => {
          chunks.push(new Uint8Array(chunk))
        })
        .on('end', () => {
          const merged = new Uint8Array(
            chunks.reduce((sum, chunk) => sum + chunk.length, 0)
          )
          let offset = 0
          for (const chunk of chunks) {
            merged.set(chunk, offset)
            offset += chunk.length
          }
          resolve(merged)
        })
    })
    const decoded = fontkit.create(encoded)
    for (const pair of pairs) {
      expect(decoded.getGlyph(pair.id).path.toSVG()).toBe(
        pair.original.path.toSVG()
      )
    }
  }
)
