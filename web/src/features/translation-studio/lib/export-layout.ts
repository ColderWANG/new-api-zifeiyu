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
import bidiFactory from 'bidi-js'

import type { TranslationPage, TranslationProgress } from '../types'

export type RebuiltBlock = { text: string; heading: boolean }

export function translatedPageBlocks(
  page: TranslationPage,
  progress: TranslationProgress,
  pageNumber: number
): RebuiltBlock[] {
  const scanned = progress.regions?.[pageNumber]
  const regions =
    scanned ??
    page.regions.flatMap((region) => {
      const text = progress.translations?.[region.id]
      return text?.trim() ? [{ ...region, text }] : []
    })
  const heights = regions.map((region) => region.box[3]).sort((a, b) => a - b)
  const typicalHeight = heights[Math.floor(heights.length / 2)] ?? 0
  const blocks: RebuiltBlock[] = []
  for (const [index, region] of regions.entries()) {
    const text = region.text.trim()
    if (!text) continue
    const heading =
      text.length < 120 && (index === 0 || region.box[3] > typicalHeight * 1.4)
    const previous = regions[index - 1]
    const block = blocks.at(-1)
    if (!scanned && previous && block && !heading && !block.heading) {
      if (
        Math.abs(previous.box[1] - region.box[1]) < 2 &&
        region.box[0] > previous.box[0]
      ) {
        block.text += `    ${text}`
        continue
      }
      const gap = region.box[1] - previous.box[1] - previous.box[3]
      if (
        Math.abs(previous.box[0] - region.box[0]) < 8 &&
        gap >= -2 &&
        gap < previous.box[3] * 0.8
      ) {
        block.text += ` ${text}`
        continue
      }
    }
    blocks.push({ text, heading })
  }
  return blocks
}

export function wrapTranslationLines(
  text: string,
  width: number,
  language: string,
  measure: (text: string) => number
): string[] {
  const lines: string[] = []
  const words = new Intl.Segmenter(language, { granularity: 'word' })
  const characters = new Intl.Segmenter(language, { granularity: 'grapheme' })
  for (const paragraph of text
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll('\t', '    ')
    .split('\n')) {
    let line = ''
    for (const { segment } of words.segment(paragraph)) {
      if (measure(line + segment) <= width) {
        line += segment
        continue
      }
      if (line.trim()) lines.push(line.trimEnd())
      line = ''
      for (const { segment: character } of characters.segment(
        segment.trimStart()
      )) {
        if (line && measure(line + character) > width) {
          lines.push(line)
          line = ''
        }
        line += character
      }
    }
    lines.push(line.trimEnd())
  }
  return lines
}

const bidi = bidiFactory()
export type VisualTextRun<T> = {
  text: string
  level: number
  font: T
  logicalIndex: number
}
// Reorder runs, not Arabic code points: shaping still receives logical words.
export function visualTextRuns<T>(
  text: string,
  language: string,
  chooseFont: (cluster: string) => T
): VisualTextRun<T>[] {
  const embedding = bidi.getEmbeddingLevels(
    text,
    language === 'ar' ? 'rtl' : 'ltr'
  )
  const mirrored = bidi.getMirroredCharactersMap(text, embedding)
  const runs: VisualTextRun<T>[] = []
  for (const cluster of new Intl.Segmenter(language, {
    granularity: 'grapheme',
  }).segment(text)) {
    const level = embedding.levels[cluster.index]
    const font = chooseFont(cluster.segment)
    let replacement = '',
      offset = cluster.index
    for (const character of cluster.segment) {
      replacement += mirrored.get(offset) ?? character
      offset += character.length
    }
    const previous = runs.at(-1)
    if (previous && previous.level === level && previous.font === font) {
      previous.text += replacement
    } else
      {runs.push({ text: replacement, level, font, logicalIndex: cluster.index })}
  }
  const oddLevels = runs.filter((run) => run.level % 2).map((run) => run.level)
  if (!oddLevels.length) return runs
  const minimum = Math.min(...oddLevels)
  for (
    let level = Math.max(...runs.map((run) => run.level));
    level >= minimum;
    level--
  ) {
    for (let start = 0; start < runs.length;) {
      if (runs[start].level < level) {
        start++
        continue
      }
      let end = start + 1
      while (end < runs.length && runs[end].level >= level) end++
      const reversed = runs.slice(start, end).reverse()
      runs.splice(start, end - start, ...reversed)
      start = end
    }
  }
  return runs
}
