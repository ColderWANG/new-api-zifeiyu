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

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
  language: string
): string[] {
  const lines: string[] = []
  const words = new Intl.Segmenter(language, { granularity: 'word' })
  const characters = new Intl.Segmenter(language, { granularity: 'grapheme' })
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const { segment } of words.segment(paragraph)) {
      if (context.measureText(line + segment).width <= width) {
        line += segment
        continue
      }
      if (line.trim()) lines.push(line.trimEnd())
      line = ''
      // Break long words only when necessary; never split surrogate pairs or combining marks.
      for (const { segment: character } of characters.segment(
        segment.trimStart()
      )) {
        if (line && context.measureText(line + character).width > width) {
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

function paintRegion(
  context: CanvasRenderingContext2D,
  region: TranslationRegion,
  language: string
): void {
  const width = context.canvas.width
  const height = context.canvas.height
  const x = Math.max(0, Math.floor((region.box[0] * width) / 1000))
  const y = Math.max(0, Math.floor((region.box[1] * height) / 1000))
  const w = Math.min(width - x, Math.ceil((region.box[2] * width) / 1000))
  const h = Math.min(height - y, Math.ceil((region.box[3] * height) / 1000))
  if (w <= 0 || h <= 0) {
    throw new Error('The translation could not be placed on the source page.')
  }
  let fontSize = Math.min(48, h * 0.8)
  let lines: string[] = []
  let fits = false
  while (fontSize >= 5) {
    context.font = `${fontSize}px system-ui, "Microsoft YaHei", "Noto Sans", sans-serif`
    lines = wrapText(context, region.text, w, language)
    if (
      lines.length * fontSize * 1.15 <= h &&
      lines.every((line) => context.measureText(line).width <= w)
    ) {
      fits = true
      break
    }
    fontSize -= 0.5
  }
  if (!fits) {
    throw new Error(
      'The translated text does not fit in its original area. Use a more concise translation and try again.'
    )
  }
  // Match the surrounding background instead of covering every source with white.
  const samples = [
    [x - 2, y - 2],
    [x + w + 1, y - 2],
    [x - 2, y + h + 1],
    [x + w + 1, y + h + 1],
  ].map(
    ([sx, sy]) =>
      context.getImageData(
        Math.max(0, Math.min(width - 1, sx)),
        Math.max(0, Math.min(height - 1, sy)),
        1,
        1
      ).data
  )
  const background = [0, 1, 2, 3].map(
    (channel) => samples.map((pixel) => pixel[channel]).sort((a, b) => a - b)[2]
  )
  context.clearRect(x, y, w, h)
  context.fillStyle = `rgba(${background[0]},${background[1]},${background[2]},${background[3] / 255})`
  context.fillRect(x, y, w, h)
  const luminance =
    background[0] * 0.299 + background[1] * 0.587 + background[2] * 0.114
  context.fillStyle =
    background[3] < 128 || luminance > 140 ? '#171717' : '#ffffff'
  context.textBaseline = 'top'
  context.direction = language === 'ar' ? 'rtl' : 'ltr'
  context.textAlign = language === 'ar' ? 'right' : 'left'
  for (const [index, line] of lines.entries()) {
    context.fillText(
      line,
      language === 'ar' ? x + w : x,
      y + index * fontSize * 1.15
    )
  }
}

export async function renderTranslatedPage(
  page: TranslationPage,
  regions: TranslationRegion[],
  language: string,
  signal: AbortSignal
): Promise<HTMLCanvasElement> {
  signal.throwIfAborted()
  const image = new Image()
  image.src = page.image
  await image.decode()
  signal.throwIfAborted()
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not prepare this image.')
  context.drawImage(image, 0, 0)
  try {
    for (const region of regions) {
      signal.throwIfAborted()
      paintRegion(context, region, language)
    }
    return canvas
  } catch (error) {
    canvas.width = 0
    canvas.height = 0
    throw error
  }
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
  const pdf =
    format === 'pdf'
      ? await (await import('pdf-lib')).PDFDocument.create()
      : null
  for (const [index, page] of source.renderedPages.entries()) {
    signal.throwIfAborted()
    const regions =
      progress.regions?.[index + 1] ??
      page.regions.flatMap((region) => {
        const text = progress.translations?.[region.id]
        return text === undefined ? [] : [{ ...region, text }]
      })
    const canvas = await renderTranslatedPage(page, regions, language, signal)
    try {
      if (pdf) {
        const image = await pdf.embedJpg(
          await (await canvasBlob(canvas, 'image/jpeg')).arrayBuffer()
        )
        pdf.addPage([page.width, page.height]).drawImage(image, {
          x: 0,
          y: 0,
          width: page.width,
          height: page.height,
        })
      } else {
        const mime =
          format === 'jpg' || format === 'jpeg'
            ? 'image/jpeg'
            : `image/${format}`
        return await canvasBlob(canvas, mime)
      }
    } finally {
      canvas.width = 0
      canvas.height = 0
    }
  }
  signal.throwIfAborted()
  if (!pdf) throw new Error('Translate the document before downloading it.')
  return new Blob([new Uint8Array(await pdf.save())], {
    type: 'application/pdf',
  })
}
