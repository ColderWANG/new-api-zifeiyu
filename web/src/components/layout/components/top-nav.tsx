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
import { useLocation } from '@tanstack/react-router'

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
  const pathname = useLocation({ select: (location) => location.pathname })

  return (
    <PublicNavigation links={links} pathname={pathname} className={className} />
  )
}
