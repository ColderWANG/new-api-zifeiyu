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

export type StudioMode = 'text' | 'image'
export type StudioRatio = '1:1' | '3:2' | '2:3' | '16:9'
export type StudioProtocol = 'images' | 'chat'
export type StudioImage = { src: string; revisedPrompt?: string }

export type ReferenceImage = {
  file: File
  url: string
}

export const STUDIO_RATIOS: {
  value: StudioRatio
  width: number
  height: number
}[] = [
  { value: '1:1', width: 1, height: 1 },
  { value: '3:2', width: 3, height: 2 },
  { value: '2:3', width: 2, height: 3 },
  { value: '16:9', width: 16, height: 9 },
]
