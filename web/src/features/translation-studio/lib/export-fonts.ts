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
const fontBytes = new Map<string, Uint8Array>()
const canvasFonts = new Set<string>()

export type ExportFontData = { name: string; data: Uint8Array }
export async function loadExportFonts(
  text: string,
  signal: AbortSignal
): Promise<ExportFontData[]> {
  const files = [{ name: 'TranslationSans', file: 'NotoSans-Regular.ttf' }]
  if (
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}]/u.test(
      text
    )
  ) {
    files.push({ name: 'TranslationCJK', file: 'TranslationCJK-Regular.ttf' })
  }
  if (/\p{Script=Arabic}/u.test(text)) {
    files.push({
      name: 'TranslationArabic',
      file: 'NotoSansArabic-Regular.ttf',
    })
  }
  if (/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(text)) {
    files.push({
      name: 'TranslationEmoji',
      file: 'TranslationEmoji-Regular.ttf',
    })
  }
  files.push({
    name: 'TranslationSymbols',
    file: 'TranslationSymbols-Regular.ttf',
  })
  return Promise.all(
    files.map(async (file) => {
      signal.throwIfAborted()
      let data = fontBytes.get(file.file)
      if (!data) {
        const response = await fetch(`/static/translation-fonts/${file.file}`, {
          signal,
        })
        if (!response.ok) {
          throw new Error('Unable to load export fonts. Please try again.')
        }
        data = new Uint8Array(await response.arrayBuffer())
        const valid =
          (data[0] === 0 && data[1] === 1 && data[2] === 0 && data[3] === 0) ||
          new TextDecoder().decode(data.slice(0, 4)) === 'OTTO'
        if (!valid) {
          throw new Error('Unable to load export fonts. Please try again.')
        }
        fontBytes.set(file.file, data)
      }
      signal.throwIfAborted()
      return { name: file.name, data }
    })
  )
}

export async function canvasExportFontFamily(
  text: string,
  signal: AbortSignal
): Promise<string> {
  const fonts = await loadExportFonts(text, signal)
  for (const font of fonts) {
    if (canvasFonts.has(font.name)) continue
    const face = new FontFace(font.name, new Uint8Array(font.data).buffer)
    await face.load()
    signal.throwIfAborted()
    document.fonts.add(face)
    canvasFonts.add(font.name)
  }
  return `${fonts.map((font) => `"${font.name}"`).join(', ')}, sans-serif`
}
