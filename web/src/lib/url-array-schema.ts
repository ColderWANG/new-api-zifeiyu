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

For commercial licensing, please contact support@quantumnous.com.
*/
import { z } from 'zod'

function normalizeSearchValue(value: unknown): unknown {
  // Arrays represent repeated URL values. Drop empty entries so `?type=&type=1`
  // behaves like `?type=1`, but leave element validation to the field schema.
  if (Array.isArray(value)) {
    const values = value.filter(
      (item) => item !== undefined && item !== null && item !== ''
    )
    return values.length > 0 ? values : undefined
  }
  if (value === undefined || value === null || value === '') return undefined
  return [value]
}

/**
 * TanStack Router may pass a repeated search parameter as an array, but a
 * single parameter (for example `?status=1`) as a scalar. Zod intentionally
 * does not coerce an array schema from a scalar, so normalize both forms.
 *
 * `.catch` remains at field level so an invalid value only clears its own key
 * and does not make the enclosing search object discard page/filter/token.
 */
export function urlArray<T extends z.ZodType>(
  schema: T,
  fallback: z.infer<T>[] = []
) {
  return z
    .preprocess(normalizeSearchValue, z.array(schema).optional())
    .catch(fallback)
}

/**
 * Normalize a legacy scalar-or-array search value to one value. Array input
 * keeps the first value, matching single-select UI semantics.
 */
export function normalizeSingleSearchValue<T>(value: unknown): T | undefined {
  const normalized = normalizeSearchValue(value)
  return Array.isArray(normalized)
    ? (normalized[0] as T | undefined)
    : (normalized as T | undefined)
}

/**
 * URL schema for a single-select UI. It accepts a legacy repeated form while
 * exposing a scalar to the page. Companions should serialize updates with
 * `toSingleSearchValue`.
 */
export function urlSingle<T extends z.ZodType>(
  schema: T,
  fallback?: z.infer<T>
) {
  return z
    .preprocess(
      (value) => normalizeSingleSearchValue<z.infer<T>>(value),
      schema.optional()
    )
    .catch(fallback)
}

/** Compress a single-select column value before writing it to the URL. */
export function toSingleSearchValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value
}
