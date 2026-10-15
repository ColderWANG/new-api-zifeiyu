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

You should have received a copy of the GNU Affero Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Link } from '@tanstack/react-router'

import { cn } from '@/lib/utils'

import type { TopNavLink } from '../types'

type PublicNavigationProps = {
  links: TopNavLink[]
  pathname?: string
  className?: string
  onNavigate?: (
    link: TopNavLink,
    event: React.MouseEvent<HTMLAnchorElement>
  ) => void
}

/**
 * Shared desktop Mono navigation used by public pages and the console header.
 */
export function PublicNavigation({
  links,
  pathname,
  className,
  onNavigate,
}: PublicNavigationProps) {
  return (
    <nav
      aria-label='Primary'
      className={cn(
        'hidden min-w-0 items-center justify-center gap-5 xl:gap-6 lg:flex',
        className
      )}
    >
      {links.map((link) => {
        const isActive = pathname === link.href
        const linkClassName = cn(
          'mm-nav inline-flex min-w-0 max-w-full shrink-0 items-center justify-center truncate text-foreground transition-none outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4',
          isActive
            ? 'font-extrabold'
            : 'font-medium hover:underline hover:decoration-2 hover:underline-offset-4',
          link.disabled && 'pointer-events-none opacity-50'
        )

        if (link.external) {
          return (
            <a
              key={`${link.title}:${link.href}`}
              href={link.href}
              target='_blank'
              rel='noopener noreferrer'
              aria-disabled={link.disabled}
              tabIndex={link.disabled ? -1 : undefined}
              onClick={(event) => onNavigate?.(link, event)}
              className={linkClassName}
            >
              {link.title}
            </a>
          )
        }

        return (
          <Link
            key={`${link.title}:${link.href}`}
            to={link.href}
            disabled={link.disabled}
            aria-current={isActive ? 'page' : undefined}
            onClick={(event) => onNavigate?.(link, event)}
            className={linkClassName}
          >
            {link.title}
          </Link>
        )
      })}
    </nav>
  )
}
