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
import { Fragment, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type QuotaDetailsPopoverProps = {
  title: string
  triggerLabel: string
  details: ReadonlyArray<{ label: string; value: string }>
  description?: string
  children: ReactNode
  afterTrigger?: ReactNode
  className?: string
  triggerClassName?: string
}

export function QuotaDetailsPopover(props: QuotaDetailsPopoverProps) {
  return (
    <Popover>
      <div className={cn('w-full min-w-0', props.className)}>
        <PopoverTrigger
          render={
            <Button
              variant='ghost'
              aria-label={props.triggerLabel}
              className={cn(
                'h-auto w-full min-w-0 justify-start rounded-none px-0 py-0.5 text-left font-normal hover:bg-transparent aria-expanded:bg-transparent',
                props.triggerClassName
              )}
            />
          }
        >
          {props.children}
        </PopoverTrigger>
        {props.afterTrigger}
      </div>
      <PopoverContent
        align='start'
        className='w-72 max-w-[calc(100vw-2rem)] gap-3 rounded-none border-2 border-black bg-white p-3.5 shadow-none dark:border-white dark:bg-black'
      >
        <PopoverTitle className='mb-2 text-xs font-semibold tracking-wider uppercase'>
          {props.title}
        </PopoverTitle>
        <dl className='grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-xs'>
          {props.details.map((detail) => (
            <Fragment key={detail.label}>
              <dt className='text-muted-foreground'>{detail.label}</dt>
              <dd className='text-right font-mono font-medium break-all tabular-nums'>
                {detail.value}
              </dd>
            </Fragment>
          ))}
        </dl>
        {props.description && (
          <p className='text-muted-foreground mt-2 border-t border-black/10 pt-2 text-xs leading-relaxed dark:border-white/10'>
            {props.description}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
