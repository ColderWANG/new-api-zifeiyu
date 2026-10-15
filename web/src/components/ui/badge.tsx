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
import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-none border px-2 py-0.5 text-xs font-mono font-medium whitespace-nowrap transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-white focus-visible:outline-offset-1 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default:
          'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black [a]:hover:opacity-85',
        secondary:
          'border-neutral-300 bg-neutral-100 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 [a]:hover:bg-neutral-200 dark:[a]:hover:bg-neutral-800',
        destructive:
          'border-2 border-black bg-white text-black font-bold dark:border-white dark:bg-black dark:text-white [a]:hover:bg-neutral-100 dark:[a]:hover:bg-neutral-900',
        warning:
          'border border-dashed border-black bg-white text-black dark:border-white dark:bg-black dark:text-white',
        outline:
          'border border-black bg-white text-black dark:border-white dark:bg-black dark:text-white [a]:hover:bg-neutral-100 dark:[a]:hover:bg-neutral-900',
        ghost:
          'border-transparent hover:bg-neutral-100 hover:text-black dark:hover:bg-neutral-900 dark:hover:text-white',
        link: 'text-black underline-offset-4 hover:underline dark:text-white border-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  })
}

export { Badge, badgeVariants }
