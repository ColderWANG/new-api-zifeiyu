/**
 * Default top navigation links used before backend status resolves.
 *
 * Backend status keeps priority once available. These static links prevent
 * an empty-header flash and preserve the public navigation contract.
 */
import type { TopNavLink } from '../types'

export const defaultTopNavLinks: TopNavLink[] = [
  { title: 'Home', href: '/' },
  { title: 'Console', href: '/dashboard' },
  { title: 'Model Square', href: '/pricing' },
  { title: 'Rankings', href: '/rankings' },
  { title: 'Game Center', href: '/games', requiresAuth: true },
  { title: 'Docs', href: '/docs' },
  { title: 'About', href: '/about' },
]
