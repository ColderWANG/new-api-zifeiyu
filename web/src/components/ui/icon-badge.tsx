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
import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const iconBadgeVariants = cva(
  'flex shrink-0 items-center justify-center rounded-none border border-black [&>svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'bg-neutral-100 text-black',
        primary: 'bg-black text-white',
        success: 'bg-neutral-100 text-black',
        warning: 'border-dashed bg-white text-black',
        info: 'bg-neutral-100 text-black',
        destructive: 'bg-black text-white font-bold',
        'chart-1': 'bg-neutral-100 text-black',
        'chart-2': 'bg-neutral-100 text-black',
        'chart-3': 'bg-neutral-100 text-black',
        'chart-4': 'bg-neutral-100 text-black',
        'chart-5': 'bg-neutral-100 text-black',
      },
      size: {
        xs: 'size-5 [&>svg]:size-3',
        sm: 'size-7 [&>svg]:size-3.5',
        md: 'size-8 [&>svg]:size-4',
        title: 'size-8 sm:size-9 [&>svg]:size-4',
        lg: 'size-10 [&>svg]:size-5',
        stat: 'size-5 sm:size-7 [&>svg]:size-3 sm:[&>svg]:size-3.5',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'md',
    },
  }
)

export type IconBadgeTone = NonNullable<
  VariantProps<typeof iconBadgeVariants>['tone']
>

export type IconBadgeSize = NonNullable<
  VariantProps<typeof iconBadgeVariants>['size']
>

interface IconBadgeProps {
  children?: ReactNode
  tone?: IconBadgeTone
  size?: IconBadgeSize
  className?: string
  decorative?: boolean
}

export function IconBadge(props: IconBadgeProps) {
  return (
    <span
      className={cn(
        iconBadgeVariants({ tone: props.tone, size: props.size }),
        props.className
      )}
      aria-hidden={props.decorative ?? true}
    >
      {props.children}
    </span>
  )
}
