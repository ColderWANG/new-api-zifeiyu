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
import { Link, useLocation } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import type { TopNavLink } from '../types'
import { PublicNavigation } from './public-navigation'

type TopNavProps = {
  links: TopNavLink[]
  className?: string
}

/**
 * Console wrapper around the shared public Mono navigation.
 */
export function TopNav({ links, className }: TopNavProps) {
  const { t } = useTranslation()
  const pathname = useLocation({ select: (location) => location.pathname })

  return (
    <>
      <PublicNavigation
        links={links}
        pathname={pathname}
        className={cn('lg:hidden 2xl:flex', className)}
      />
      <div className='hidden lg:block 2xl:hidden'>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant='ghost'
                className='h-9 max-w-48'
                aria-label={t('Toggle navigation menu')}
              />
            }
          >
            <span className='truncate'>
              {links.find((link) => link.href === pathname)?.title ?? t('Home')}
            </span>
            <ChevronDown className='ml-2 size-4 shrink-0' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='center'>
            {links.map((link) => (
              <DropdownMenuItem
                key={link.href}
                disabled={link.disabled}
                render={
                  link.external ? (
                    <a
                      href={link.href}
                      target='_blank'
                      rel='noopener noreferrer'
                    />
                  ) : (
                    <Link to={link.href} />
                  )
                }
              >
                {link.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
