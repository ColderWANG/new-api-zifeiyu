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
import fontkit, { type Font, type GlyphRun } from '@pdf-lib/fontkit'
import {
  PDFDocument,
  PDFHexString,
  type PDFName,
  beginText,
  endText,
  setFontAndSize,
  setTextMatrix,
  showText,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'

import type {
  TranslationLanguage,
  TranslationPage,
  TranslationProgress,
} from '../types'
import { loadExportFonts } from './export-fonts'
import {
  translatedPageBlocks,
  visualTextRuns,
  wrapTranslationLines,
} from './export-layout'

type EmbeddedFont = { name: string; pdf: PDFFont; raw: Font }
type ShapedRun = {
  logicalIndex: number
  font: EmbeddedFont
  text: string
  shape: GlyphRun
  width: number
}

function shapeLine(
  text: string,
  language: string,
  size: number,
  fonts: EmbeddedFont[]
): ShapedRun[] {
  const runs = visualTextRuns(text, language, (cluster) => {
    const spaceFont = fonts.find(
      (candidate) => candidate.name === 'TranslationSans'
    )
    const candidates =
      /^\s+$/u.test(cluster) && spaceFont ? [spaceFont, ...fonts] : fonts
    const font = candidates.find((candidate) =>
      [...cluster].every(
        (character) =>
          /\p{Default_Ignorable_Code_Point}/u.test(character) ||
          candidate.raw.hasGlyphForCodePoint(character.codePointAt(0) ?? 0)
      )
    )
    if (!font) {
      throw new Error(
        'Some characters could not be rendered in the PDF. The translation is still available to copy.'
      )
    }
    return font
  })
  return runs.map((run) => {
    let content = run.text
    let shape = run.font.raw.layout(content)
    if ((run.level % 2 === 1) !== (shape.direction === 'rtl')) {
      content = [
        ...new Intl.Segmenter(language, { granularity: 'grapheme' }).segment(
          content
        ),
      ]
        .map((cluster) => cluster.segment)
        .reverse()
        .join('')
      shape = run.font.raw.layout(content)
    }
    return {
      logicalIndex: run.logicalIndex,
      font: run.font,
      text: content,
      shape,
      width:
        (shape.positions.reduce((sum, position) => sum + position.xAdvance, 0) *
          size) /
        run.font.raw.unitsPerEm,
    }
  })
}

// Native text operators preserve selection/search. Explicit glyph positions also
// preserve kerning and Arabic mark placement that a bitmap export would discard.
function drawTextLine(
  page: PDFPage,
  runs: ShapedRun[],
  x: number,
  y: number,
  size: number,
  resources: Map<PDFFont, PDFName>
): void {
  page.pushOperators(beginText())
  let advance = x
  const positions = new Map<ShapedRun, number>()
  for (const run of runs) {
    positions.set(run, advance)
    advance += run.width
  }
  // Keep visual coordinates, but emit logical runs so copied RTL words retain their reading order.
  for (const run of [...runs].sort((a, b) => a.logicalIndex - b.logicalIndex)) {
    let pen = positions.get(run) ?? x
    let resource = resources.get(run.font.pdf)
    if (!resource) {
      resource = page.node.newFontDictionary(
        run.font.pdf.name,
        run.font.pdf.ref
      )
      resources.set(run.font.pdf, resource)
    }
    const encoded = run.font.pdf.encodeText(run.text).asString()
    const scale = size / run.font.raw.unitsPerEm
    for (const [index, position] of run.shape.positions.entries()) {
      page.pushOperators(
        setFontAndSize(resource, size),
        setTextMatrix(
          1,
          0,
          0,
          1,
          pen + position.xOffset * scale,
          y + position.yOffset * scale
        ),
        showText(PDFHexString.of(encoded.slice(index * 4, index * 4 + 4)))
      )
      pen += position.xAdvance * scale
    }
  }
  page.pushOperators(endText())
}

export async function exportRebuiltPdf(
  pages: TranslationPage[],
  progress: TranslationProgress,
  language: TranslationLanguage,
  signal: AbortSignal
): Promise<Blob> {
  const content = pages
    .map((page, index) => ({
      source: page,
      blocks: translatedPageBlocks(page, progress, index + 1),
    }))
    .filter((page) => page.blocks.length > 0)
  const text = content
    .flatMap((page) => page.blocks.map((block) => block.text))
    .join('\n')
  if (!text.trim()) {
    throw new Error('No translated text is available to export.')
  }
  if (text.length > 200_000) {
    throw new Error(
      'The translated document is too large to export. Split the source into smaller files.'
    )
  }
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setLanguage(language)
  const fontData = await loadExportFonts(text, signal)
  let preferred = 'TranslationSans'
  if (language === 'ar') preferred = 'TranslationArabic'
  else if (
    language.startsWith('zh') ||
    language === 'ja' ||
    language === 'ko'
  ) {
    preferred = 'TranslationCJK'
  }
  fontData.sort((a, b) => {
    if (a.name === preferred) return -1
    if (b.name === preferred) return 1
    return 0
  })
  const fonts: EmbeddedFont[] = []
  for (const data of fontData) {
    signal.throwIfAborted()
    fonts.push({
      name: data.name,
      pdf: await pdf.embedFont(data.data, { subset: true }),
      raw: fontkit.create(data.data),
    })
  }
  for (const item of content) {
    const width =
      item.source.width >= 300 && item.source.width <= 1440
        ? item.source.width
        : 595.28
    const height =
      item.source.height >= 400 && item.source.height <= 1800
        ? item.source.height
        : 841.89
    const margin = Math.min(48, width * 0.09)
    const usableWidth = width - 2 * margin
    let page = pdf.addPage([width, height])
    let resources = new Map<PDFFont, PDFName>()
    let y = height - margin
    for (const block of item.blocks) {
      signal.throwIfAborted()
      const size = block.heading ? 18 : 11.5
      const lines = wrapTranslationLines(
        block.text,
        usableWidth,
        language,
        (value) =>
          shapeLine(value, language, size, fonts).reduce(
            (sum, run) => sum + run.width,
            0
          )
      )
      for (const line of lines) {
        signal.throwIfAborted()
        const runs = shapeLine(line, language, size, fonts)
        const ascent = Math.max(
          size,
          ...runs.map(
            (run) => (run.font.raw.ascent * size) / run.font.raw.unitsPerEm
          )
        )
        const descent = Math.max(
          size * 0.2,
          ...runs.map(
            (run) => (-run.font.raw.descent * size) / run.font.raw.unitsPerEm
          )
        )
        const lineHeight = Math.max(size * 1.5, ascent + descent + size * 0.15)
        if (y - lineHeight < margin) {
          if (pdf.getPageCount() >= 200) {
            throw new Error(
              'The translated document is too large to export. Split the source into smaller files.'
            )
          }
          page = pdf.addPage([width, height])
          resources = new Map()
          y = height - margin
        }
        const lineWidth = runs.reduce((sum, run) => sum + run.width, 0)
        const x = language === 'ar' ? width - margin - lineWidth : margin
        drawTextLine(page, runs, x, y - ascent, size, resources)
        y -= lineHeight
      }
      y -= block.heading ? 12 : 7
    }
  }
  signal.throwIfAborted()
  return new Blob([new Uint8Array(await pdf.save())], {
    type: 'application/pdf',
  })
}
