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
import { api, getFreshAuthHeaders } from '@/lib/api'

import { diagnoseStudioResponse } from './response-error'
import type { StudioProtocol, StudioRatio, StudioImage } from './types'

export type GenerateImageInput = {
  model: string
  protocol: StudioProtocol
  prompt: string
  ratio: StudioRatio
  count: number
  reference?: File
}

export async function generateStudioImages(
  input: GenerateImageInput,
  signal: AbortSignal
): Promise<StudioImage[]> {
  // Refresh before billing, never replay a generation after an upstream 401.
  // Do not copy getFreshAuthHeaders' JSON Content-Type onto multipart uploads.
  await getFreshAuthHeaders()
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const sizes: Record<StudioRatio, string> = {
    '1:1': '1024x1024',
    '3:2': '1536x1024',
    '2:3': '1024x1536',
    '16:9': '1536x864',
  }
  const fields = {
    model: input.model,
    protocol: input.protocol,
    prompt: input.prompt,
    n: input.count,
    size: sizes[input.ratio],
    aspect_ratio: input.ratio,
  }
  let body: FormData | typeof fields = fields
  if (input.reference) {
    body = new FormData()
    for (const [key, value] of Object.entries(fields)) {
      body.append(key, String(value))
    }
    body.append('image', input.reference)
  }
  const response = await api.post('/pg/image-studio', body, {
    signal,
    timeout: 660_000,
    // A provider's 401 must not replay a billable request as an auth refresh.
    skipAuthRefresh: true,
    skipErrorHandler: true,
  })
  const images = parseStudioImages(response.data)
  if (images.length === 0) {
    throw diagnoseStudioResponse(
      response.data,
      response.headers?.['x-oneapi-request-id']
    )
  }
  return images
}

export function parseStudioImages(response: unknown): StudioImage[] {
  const images: StudioImage[] = []
  const seen = new Set<string>()
  const add = (src: unknown, revisedPrompt?: unknown) => {
    if (typeof src !== 'string') return
    const value = src.trim()
    if (
      !/^https?:\/\//i.test(value) &&
      !/^data:image\/(png|jpe?g|webp|gif);base64,[a-z\d+/=\s]+$/i.test(value)
    ) {
      return
    }
    if (seen.has(value)) return
    seen.add(value)
    images.push({
      src: value,
      revisedPrompt:
        typeof revisedPrompt === 'string' ? revisedPrompt : undefined,
    })
  }
  if (!response || typeof response !== 'object') return images
  const data = response as Record<string, unknown>
  if (data.error) {
    throw new Error(
      typeof data.error === 'object' && data.error && 'message' in data.error
        ? String(data.error.message)
        : 'Image generation failed.'
    )
  }
  const entries = Array.isArray(data.data) ? data.data : [data.data]
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    if (typeof entry.b64_json === 'string' && entry.b64_json.trim()) {
      const raw = entry.b64_json.trim()
      let mime = 'image/png'
      if (raw.startsWith('/9j/')) mime = 'image/jpeg'
      else if (raw.startsWith('UklGR')) mime = 'image/webp'
      add(`data:${mime};base64,${raw}`, entry.revised_prompt)
    } else add(entry.url, entry.revised_prompt)
  }
  if (Array.isArray(data.choices)) {
    for (const choice of data.choices) {
      const message = choice?.message
      if (!message || typeof message !== 'object') continue
      if (typeof message.content === 'string') {
        for (const match of message.content.matchAll(
          /!\[[^\]]*\]\((https?:\/\/[^\s)]+|data:image\/(?:png|jpe?g|webp|gif);base64,[a-z\d+/=]+)\)/gi
        )) {
          add(match[1])
        }
      }
      const parts = [
        ...(Array.isArray(message.content) ? message.content : []),
        ...(Array.isArray(message.images) ? message.images : []),
      ]
      for (const part of parts) {
        add(
          typeof part?.image_url === 'string'
            ? part.image_url
            : part?.image_url?.url
        )
      }
    }
  }
  return images
}
