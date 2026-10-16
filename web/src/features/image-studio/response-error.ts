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

type StudioResponseErrorKind =
  | 'refused'
  | 'text-only'
  | 'unreadable-image'
  | 'incomplete'
  | 'empty'
  | 'invalid-response'

export class StudioResponseError extends Error {
  readonly requestId?: string

  constructor(
    readonly kind: StudioResponseErrorKind,
    readonly reply: string,
    requestId?: unknown
  ) {
    super('Image generation failed.')
    this.name = 'StudioResponseError'
    if (typeof requestId === 'string' && /^[\w.-]{1,128}$/.test(requestId)) {
      this.requestId = requestId
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function replyExcerpt(text: unknown): string {
  if (typeof text !== 'string') return ''
  // Never retain whole response bodies, image blobs, reasoning or request configs.
  return text
    .slice(0, 4000)
    .replaceAll(/data:image\/[^\s)"'<>]+/gi, '[…]')
    .replaceAll(/\bBearer\s+[^\s,;]+/gi, 'Bearer […]')
    .replaceAll(/\b(?:sk-|cpa-)[\w-]+/gi, '[…]')
    .trim()
}

/** Diagnose only responses with no usable images; never infer policy from a prompt. */
export function diagnoseStudioResponse(
  response: unknown,
  requestId?: unknown
): StudioResponseError {
  if (response == null || response === '') {
    return new StudioResponseError('empty', '', requestId)
  }
  if (typeof response !== 'object' || Array.isArray(response)) {
    return new StudioResponseError('invalid-response', '', requestId)
  }

  const data = asRecord(response)
  const replies: string[] = []
  const refusals: string[] = []
  let refused = false
  let incomplete = false
  let imagePayload = false
  let knownShape = Object.keys(data).length === 0
  const blockedReasons = new Set([
    'content_filter',
    'SAFETY',
    'IMAGE_SAFETY',
    'RECITATION',
    'IMAGE_RECITATION',
    'BLOCKLIST',
    'PROHIBITED_CONTENT',
    'IMAGE_PROHIBITED_CONTENT',
    'SPII',
  ])

  const entries = Array.isArray(data.data) ? data.data : [data.data]
  if (data.data != null) knownShape = true
  for (const entry of entries) {
    const item = asRecord(entry)
    if ('b64_json' in item || 'url' in item) imagePayload = true
  }

  const messages: Record<string, unknown>[] = []
  if (Array.isArray(data.choices)) {
    knownShape = true
    for (const entry of data.choices) {
      const choice = asRecord(entry)
      refused ||= blockedReasons.has(String(choice.finish_reason))
      incomplete ||= choice.finish_reason === 'length'
      messages.push(asRecord(choice.message))
    }
  }
  if (Array.isArray(data.candidates)) {
    knownShape = true
    for (const entry of data.candidates) {
      const candidate = asRecord(entry)
      refused ||= blockedReasons.has(String(candidate.finishReason))
      incomplete ||= candidate.finishReason === 'MAX_TOKENS'
      messages.push({ content: asRecord(candidate.content).parts })
    }
  }
  const feedback = asRecord(data.promptFeedback)
  if (Object.keys(feedback).length > 0) {
    knownShape = true
    refused ||=
      typeof feedback.blockReason === 'string' &&
      feedback.blockReason !== '' &&
      feedback.blockReason !== 'BLOCK_REASON_UNSPECIFIED'
  }

  for (const message of messages) {
    const refusal = replyExcerpt(message.refusal)
    if (refusal) {
      refused = true
      refusals.push(refusal)
    }
    if (typeof message.content === 'string') {
      imagePayload ||= /!\[[^\]]*\]\(|data:image\//i.test(message.content)
      replies.push(replyExcerpt(message.content))
    }
    const parts = Array.isArray(message.content) ? message.content : []
    if (Array.isArray(message.images) && message.images.length > 0) {
      imagePayload = true
    }
    for (const value of parts) {
      const part = asRecord(value)
      // Gemini thought parts are internal reasoning, not user-facing explanations.
      if (
        part.thought === true ||
        part.type === 'reasoning' ||
        part.type === 'thinking'
      ) {
        continue
      }
      if (part.type === 'refusal') {
        refused = true
        refusals.push(replyExcerpt(part.refusal))
      } else if (
        part.type == null ||
        part.type === 'text' ||
        part.type === 'output_text'
      ) {
        replies.push(replyExcerpt(part.text))
        if (typeof part.text === 'string') {
          imagePayload ||= /!\[[^\]]*\]\(|data:image\//i.test(part.text)
        }
      }
      imagePayload ||=
        'image_url' in part ||
        'inlineData' in part ||
        'inline_data' in part ||
        'fileData' in part ||
        'file_data' in part ||
        part.type === 'image' ||
        part.type === 'image_url'
    }
  }

  const text = [...refusals, ...replies].filter(Boolean).join('\n\n')
  const excerpt = text.length > 1000 ? `${text.slice(0, 1000)}…` : text
  let kind: StudioResponseErrorKind = 'empty'
  if (refused) kind = 'refused'
  else if (incomplete) kind = 'incomplete'
  else if (imagePayload) kind = 'unreadable-image'
  else if (text) kind = 'text-only'
  else if (!knownShape) kind = 'invalid-response'
  return new StudioResponseError(kind, excerpt, requestId)
}
