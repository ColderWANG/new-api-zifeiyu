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
import { describe, expect, it } from 'vitest'

import {
  translatedPageBlocks,
  visualTextRuns,
  wrapTranslationLines,
} from '../lib/export-layout'
import type { TranslationPage } from '../types'

const source: TranslationPage = {
  image: 'original-background-must-never-be-exported',
  width: 600,
  height: 800,
  regions: [
    { id: 'title', text: 'Original title', box: [50, 50, 500, 60] },
    { id: 'private', text: 'UNTRANSLATED ORIGINAL', box: [50, 200, 500, 30] },
    { id: 'body', text: 'Original body', box: [50, 400, 500, 30] },
  ],
}
describe('rebuilt translation layout', () => {
  it('uses translated content only, even for a partially completed document', () => {
    const blocks = translatedPageBlocks(
      source,
      {
        completed: 1,
        total: 2,
        text: '',
        translations: { title: 'New title', body: 'New body' },
      },
      1
    )
    expect(blocks).toEqual([
      { text: 'New title', heading: true },
      { text: 'New body', heading: false },
    ])
    expect(JSON.stringify(blocks)).not.toContain('ORIGINAL')
    expect(source.regions[0].text).toBe('Original title')
  })
  it('keeps OCR paragraphs in reading order without using source coordinates to place them', () => {
    const regions = [
      {
        id: 'a',
        text: 'Translated heading',
        box: [900, 800, 100, 200] as [number, number, number, number],
      },
      {
        id: 'b',
        text: 'Translated paragraph',
        box: [0, 0, 20, 10] as [number, number, number, number],
      },
    ]
    expect(
      translatedPageBlocks(
        source,
        { completed: 1, total: 1, text: '', regions: { 1: regions } },
        1
      ).map((block) => block.text)
    ).toEqual(['Translated heading', 'Translated paragraph'])
  })
  it('wraps long text without losing graphemes or splitting combining marks', () => {
    const cluster = `a\u0301${String.fromCodePoint(0x1f469, 0x200d, 0x1f4bb)}`
    const text = cluster.repeat(15)
    const length = (value: string) =>
      [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(value)]
        .length
    const lines = wrapTranslationLines(text, 4, 'en', length)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join('')).toBe(text)
    expect(lines.every((line) => length(line) <= 4)).toBe(true)
    expect(lines.every((line) => !/^\p{Mark}/u.test(line))).toBe(true)
  })
  it('handles Windows line breaks as layout rather than unsupported font characters', () => {
    expect(
      wrapTranslationLines('one\r\ntwo\rthree', 100, 'en', (s) => s.length)
    ).toEqual(['one', 'two', 'three'])
  })
  it('reorders mixed Arabic and Latin runs without reversing logical Arabic words', () => {
    const arabic = '\u0633\u0644\u0627\u0645'
    const runs = visualTextRuns(`abc 123 ${arabic}`, 'ar', (cluster) =>
      /\p{Script=Arabic}/u.test(cluster) ? 'arabic' : 'latin'
    )
    expect(runs[0].text).toBe(arabic)
    expect(runs.at(-1)?.text).toBe('abc 123')
  })
})
