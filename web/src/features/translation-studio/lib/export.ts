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
import type {
  TranslationLanguage,
  TranslationPage,
  TranslationProgress,
  TranslationRegion,
  TranslationSource,
} from '../types'
import { exportDocx } from './docx'
import { canvasExportFontFamily } from './export-fonts'
import { translatedPageBlocks, wrapTranslationLines } from './export-layout'

export function translationDownloadName(
  source: TranslationSource | null,
  language: string,
  partial: boolean
): string {
  const filename = (source?.name ?? 'translation')
    .replace(/\.[^.]+$/, '')
    .replaceAll(/[<>:"/\\|?*]/g, '_')
  return `${filename}-${language}${partial ? '-partial' : ''}.${source?.format ?? 'txt'}`
}

export async function renderTranslatedPage(
  page: TranslationPage,
  regions: TranslationRegion[],
  language: string,
  signal: AbortSignal
): Promise<HTMLCanvasElement> {
  signal.throwIfAborted()
  const blocks = translatedPageBlocks(
    page,
    { completed: 1, total: 1, text: '', regions: { 1: regions } },
    1
  )
  const text = blocks.map((block) => block.text).join('\n')
  if (!text.trim()) {
    throw new Error('No translated text is available to export.')
  }
  if (text.length > 200_000) {
    throw new Error(
      'The translated document is too large to export. Split the source into smaller files.'
    )
  }
  const family = await canvasExportFontFamily(text, signal)
  const width = Math.max(480, Math.min(2048, Math.round(page.width)))
  const margin = Math.round(width * 0.07)
  const baseSize = Math.max(20, Math.min(36, width * 0.03))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not prepare this image.')
  const layout = []
  let y = margin
  for (const block of blocks) {
    const size = block.heading ? baseSize * 1.5 : baseSize
    context.font = `${size}px ${family}`
    const lines = wrapTranslationLines(
      block.text,
      width - margin * 2,
      language,
      (value) => context.measureText(value).width
    )
    for (const line of lines) {
      const metrics = context.measureText(line || 'M')
      const ascent = Math.max(
        size,
        metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent || size
      )
      const descent = Math.max(
        size * 0.2,
        metrics.fontBoundingBoxDescent ||
          metrics.actualBoundingBoxDescent ||
          size * 0.2
      )
      layout.push({ text: line, size, y: y + ascent })
      y += Math.max(size * 1.55, ascent + descent + size * 0.15)
    }
    y += baseSize * 0.6
  }
  const height = Math.max(
    320,
    Math.ceil((page.height * width) / Math.max(1, page.width)),
    Math.ceil(y + margin)
  )
  if (height > 32760 || width * height > 40_000_000) {
    throw new Error(
      'The rebuilt image is too large. Split the source into smaller files.'
    )
  }
  canvas.width = width
  canvas.height = height
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#171717'
  context.textBaseline = 'alphabetic'
  context.direction = language === 'ar' ? 'rtl' : 'ltr'
  context.textAlign = language === 'ar' ? 'right' : 'left'
  for (const line of layout) {
    signal.throwIfAborted()
    context.font = `${line.size}px ${family}`
    context.fillText(
      line.text,
      language === 'ar' ? width - margin : margin,
      line.y
    )
  }
  return canvas
}

function canvasBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (blob && blob.type === type) resolve(blob)
        else {
          reject(
            new Error(
              'Your browser could not export this file format. Try another browser.'
            )
          )
        }
      },
      type,
      0.95
    )
  )
}

export async function exportTranslation(
  source: TranslationSource | null,
  progress: TranslationProgress,
  language: TranslationLanguage,
  signal: AbortSignal
): Promise<Blob> {
  signal.throwIfAborted()
  const format = source?.format ?? 'txt'
  if (format === 'docx') {
    if (!source?.docx || !progress.translations) {
      throw new Error('Translate the document before downloading it.')
    }
    return exportDocx(source.docx, progress.translations)
  }
  if (format === 'txt' || format === 'md') {
    return new Blob([progress.text], {
      type: `${format === 'md' ? 'text/markdown' : 'text/plain'};charset=utf-8`,
    })
  }
  if (!source?.renderedPages?.length) {
    throw new Error('Translate the document before downloading it.')
  }
  if (format === 'pdf') {
    const { exportRebuiltPdf } = await import('./pdf-export')
    return exportRebuiltPdf(source.renderedPages, progress, language, signal)
  }
  const page = source.renderedPages[0]
  const regions =
    progress.regions?.[1] ??
    page.regions.flatMap((region) => {
      const text = progress.translations?.[region.id]
      return text === undefined ? [] : [{ ...region, text }]
    })
  const canvas = await renderTranslatedPage(page, regions, language, signal)
  try {
    const mime =
      format === 'jpg' || format === 'jpeg' ? 'image/jpeg' : `image/${format}`
    return await canvasBlob(canvas, mime)
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}
