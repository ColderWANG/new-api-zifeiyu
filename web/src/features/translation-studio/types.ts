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

export type TranslationUnit = { text?: string; image?: string; page?: number }
export type TranslationSource = {
  name: string
  size: number
  text: string
  units: TranslationUnit[]
  pages: number
  imagePages: number
  preview?: string
}
export type TranslationProgress = {
  completed: number
  total: number
  text: string
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
