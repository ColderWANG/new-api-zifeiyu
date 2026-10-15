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
import i18next from 'i18next'
import { toast } from 'sonner'

import {
  getServerErrorMessage,
  getServerErrorRetryAfterSeconds,
  getServerErrorStatus,
  getServerErrorSources,
  isServerErrorCancelled,
} from './server-error-message'

const reportedErrors = new WeakSet<object>()

/** Also used when a failure has already been presented inline. */
export function markServerErrorHandled(error: unknown): void {
  for (const source of getServerErrorSources(error)) reportedErrors.add(source)
}

export function handleServerError(
  error: unknown,
  fallbackMessage?: string,
  presentation?: { title: string; description?: string }
): void {
  if (isServerErrorCancelled(error)) return
  const sources = getServerErrorSources(error)
  const reported = sources.some((source) => reportedErrors.has(source))
  markServerErrorHandled(error)
  if (reported) return
  const status = getServerErrorStatus(error)
  const retryAfterSeconds = getServerErrorRetryAfterSeconds(error)
  const isRateLimited = status === 429
  const message =
    presentation?.title ||
    (isRateLimited
      ? i18next.t('Too many requests')
      : getServerErrorMessage(error, fallbackMessage))
  const description =
    presentation?.description ??
    (isRateLimited
      ? i18next.t('Please wait {{seconds}} seconds before trying again.', {
          seconds: retryAfterSeconds ?? i18next.t('a moment'),
        })
      : undefined)
  if (description) {
    toast.error(message, { description })
  } else {
    toast.error(message)
  }
}
