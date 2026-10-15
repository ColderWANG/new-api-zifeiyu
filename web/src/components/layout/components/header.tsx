/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  Children,
  isValidElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'

import { cn } from '@/lib/utils'

type HeaderSlotProps = { children?: React.ReactNode }

function HeaderLeft(props: HeaderSlotProps) {
  return (
    <div className='flex min-w-0 shrink-0 items-center gap-3'>
      {props.children}
    </div>
  )
}

function HeaderCenter(props: HeaderSlotProps) {
  return (
    <div className='pointer-events-none absolute top-1/2 left-1/2 z-0 flex min-w-0 -translate-x-1/2 -translate-y-1/2 items-center justify-center px-2'>
      <div className='pointer-events-auto flex min-w-0 items-center justify-center'>
        {props.children}
      </div>
    </div>
  )
}

function HeaderRight(props: HeaderSlotProps) {
  return (
    <div className='flex min-w-0 shrink-0 items-center justify-end gap-2 sm:gap-3'>
      {props.children}
    </div>
  )
}

export function Header({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement>) {
  const slots = {
    left: null as ReactNode,
    center: null as ReactNode,
    right: null as ReactNode,
    rest: [] as ReactNode[],
  }

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const element = child as ReactElement<HeaderSlotProps>
    if (child.type === HeaderLeft) slots.left = element.props.children
    else if (child.type === HeaderCenter) slots.center = element.props.children
    else if (child.type === HeaderRight) slots.right = element.props.children
    else slots.rest.push(child)
  })

  return (
    <header
      className={cn(
        'sticky top-0 z-40 h-16 w-full shrink-0 border-b border-border bg-background/95 text-foreground backdrop-blur supports-[backdrop-filter]:bg-background/85',
        className
      )}
      {...props}
    >
      <div className='relative mx-auto flex h-full w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8'>
        <div className='min-w-0 flex-auto' />
        <HeaderLeft>
          {slots.left}
          {slots.rest}
        </HeaderLeft>
        <HeaderRight>{slots.right}</HeaderRight>
      </div>
      <HeaderCenter>{slots.center}</HeaderCenter>
    </header>
  )
}

Header.Left = HeaderLeft
Header.Center = HeaderCenter
Header.Right = HeaderRight
