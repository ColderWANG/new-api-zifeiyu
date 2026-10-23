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
import type { CSSProperties } from 'react'

const bows = [
  {
    className: 'top-[10%] left-[5%] size-10 -rotate-12 text-pink-300/70',
    delay: '0s',
  },
  {
    className: 'top-[20%] right-[7%] size-16 rotate-12 text-pink-300/45',
    delay: '1.4s',
  },
  {
    className: 'top-[55%] left-[8%] size-8 rotate-6 text-rose-300/50',
    delay: '2.2s',
  },
  {
    className: 'bottom-[16%] right-[11%] size-9 -rotate-6 text-pink-400/35',
    delay: '0.8s',
  },
  {
    className: 'bottom-[38%] left-[45%] size-7 rotate-3 text-pink-300/30',
    delay: '1.8s',
  },
] as const

function Bow(props: { className: string; style: CSSProperties }) {
  return (
    <svg
      viewBox='0 0 72 58'
      fill='none'
      aria-hidden='true'
      className={props.className}
      style={props.style}
    >
      <path
        d='M33 27 C29 34 25 43 22 52 L29.5 49.5 L33.5 55 C35.5 46 36 37 35.5 28 Z'
        fill='currentColor'
        opacity='0.38'
      />
      <path
        d='M39 27 C43 34 47 43 50 52 L42.5 49.5 L38.5 55 C36.5 46 36 37 36.5 28 Z'
        fill='currentColor'
        opacity='0.38'
      />
      <path
        d='M33.5 21.5 C25 7.5 7.5 4.5 6 16 C4.8 25.5 22 30.5 33.5 24.5 Z'
        fill='currentColor'
        opacity='0.6'
      />
      <path
        d='M38.5 21.5 C47 7.5 64.5 4.5 66 16 C67.2 25.5 50 30.5 38.5 24.5 Z'
        fill='currentColor'
        opacity='0.6'
      />
      <path
        d='M31 22.5 C24 15.5 14.5 13.5 11.5 17.5'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinecap='round'
        opacity='0.9'
      />
      <path
        d='M41 22.5 C48 15.5 57.5 13.5 60.5 17.5'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinecap='round'
        opacity='0.9'
      />
      <rect
        x='31.5'
        y='17.5'
        width='9'
        height='11'
        rx='3.5'
        fill='currentColor'
      />
      <rect
        x='33.6'
        y='19.6'
        width='2.6'
        height='4.5'
        rx='1.3'
        fill='white'
        opacity='0.45'
      />
    </svg>
  )
}

export function BowDecorations() {
  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute inset-0 overflow-hidden'
    >
      {bows.map((bow) => (
        <Bow
          key={bow.className}
          className={`bow-float absolute ${bow.className}`}
          style={{ animationDelay: bow.delay }}
        />
      ))}
    </div>
  )
}
