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
'use client'

import { Dialog as SheetPrimitive } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot='sheet' {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot='sheet-trigger' {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot='sheet-close' {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot='sheet-portal' {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot='sheet-overlay'
      className={cn(
        'fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0',
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: 'top' | 'right' | 'bottom' | 'left'
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot='sheet-content'
        data-side={side}
        className={cn(
          'bg-background text-foreground fixed z-50 flex flex-col gap-4 overflow-hidden rounded-none text-sm shadow-none transition duration-150 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0',
          side === 'right' &&
            'inset-y-0 right-0 h-full w-3/4 border-l-2 border-black data-ending-style:translate-x-[2.5rem] data-starting-style:translate-x-[2.5rem] sm:max-w-md',
          side === 'left' &&
            'inset-y-0 left-0 h-full w-3/4 border-r-2 border-black data-ending-style:translate-x-[-2.5rem] data-starting-style:translate-x-[-2.5rem] sm:max-w-md',
          side === 'top' &&
            'inset-x-0 top-0 h-auto border-b-2 border-black data-ending-style:translate-y-[-2.5rem] data-starting-style:translate-y-[-2.5rem]',
          side === 'bottom' &&
            'inset-x-0 bottom-0 h-auto border-t-2 border-black data-ending-style:translate-y-[2.5rem] data-starting-style:translate-y-[2.5rem]',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot='sheet-close'
            render={
              <Button
                variant='outline'
                className='absolute top-3 right-3 rounded-none border border-black'
                size='icon-sm'
              />
            }
          >
            <X className='size-4' />
            <span className='sr-only'>Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sheet-header'
      className={cn('flex flex-col gap-1 border-b border-black p-4', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='sheet-footer'
      className={cn(
        'mt-auto flex flex-col gap-2 border-t border-black p-4',
        className
      )}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot='sheet-title'
      className={cn(
        'text-foreground text-base font-semibold tracking-tight',
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot='sheet-description'
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
