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
export type TranslationMode = 'text' | 'image' | 'document'
export type TranslationStyle = 'natural' | 'faithful' | 'professional'

export const TRANSLATION_LANGUAGES = [
  { value: 'zh-CN', label: 'Simplified Chinese' },
  { value: 'zh-TW', label: 'Traditional Chinese' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'ar', label: 'Arabic' },
  { value: 'vi', label: 'Vietnamese' },
] as const
export type TranslationLanguage =
  (typeof TRANSLATION_LANGUAGES)[number]['value']

export type TranslationFormat =
  | 'txt'
  | 'md'
  | 'docx'
  | 'pdf'
  | 'png'
  | 'jpg'
  | 'jpeg'
  | 'webp'
export type TranslationSegment = { id: string; text: string; paragraph: string }
// Coordinates are normalized to 0..1000 in the displayed page orientation.
export type TranslationRegion = {
  id: string
  text: string
  box: [number, number, number, number]
}
export type TranslationPage = {
  image: string
  width: number
  height: number
  regions: TranslationRegion[]
}
export type DocxTemplate = {
  files: Record<string, Uint8Array>
  nodes: { part: string; index: number; ids: string[] }[]
}
export type TranslationUnit = {
  text?: string
  image?: string
  page?: number
  segments?: TranslationSegment[]
  locateText?: boolean
}
export type TranslationSource = {
  name: string
  size: number
  text: string
  units: TranslationUnit[]
  pages: number
  imagePages: number
  preview?: string
  format?: TranslationFormat
  docx?: DocxTemplate
  renderedPages?: TranslationPage[]
}
export type TranslationProgress = {
  completed: number
  total: number
  text: string
  translations?: Record<string, string>
  regions?: Record<number, TranslationRegion[]>
}
export type TranslationOptions = {
  model: string
  group: string
  sourceLanguage: TranslationLanguage | 'auto'
  targetLanguage: TranslationLanguage
  style: TranslationStyle
  instructions: string
  units: TranslationUnit[]
}
