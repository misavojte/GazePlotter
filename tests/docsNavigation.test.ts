import { describe, expect, it } from 'vitest'
import {
  buildDocBreadcrumbs,
  getPrevNextLinks,
  normalizeDocPath,
} from '../src/routes/docs/navigation'
import type { SidebarItem, SidebarLink } from '../src/routes/docs/sidebarConfig'

const mockSections: readonly SidebarItem[] = [
  {
    name: 'Getting Started',
    href: '/docs',
  },
  {
    title: 'Workspace & Setup',
    links: [
      { name: 'Overview', breadcrumbName: 'Workspace & Setup', href: '/docs/workspace' },
      { name: 'Analysis', href: '/docs/workspace/analysis' },
      { name: 'Workspace', href: '/docs/workspace/workspace' }
    ]
  }

] as const

const allLinks: readonly SidebarLink[] = mockSections.flatMap(item => 'links' in item ? item.links : [item])

describe('docs navigation helpers', () => {
  it('normalizes docs paths', () => {
    expect(normalizeDocPath('/docs/')).toBe('/docs')
    expect(normalizeDocPath('/docs/workspace/')).toBe('/docs/workspace')
    expect(normalizeDocPath('/')).toBe('/')
  })

  it('derives breadcrumbs correctly', () => {
    const breadcrumbs = buildDocBreadcrumbs('/docs/workspace/workspace', mockSections)
    
    expect(breadcrumbs).toEqual([
      { name: 'GazePlotter', href: '/' },
      { name: 'Docs', href: '/docs' },
      { name: 'Workspace & Setup', href: '/docs/workspace' },
      { name: 'Workspace', href: '/docs/workspace/workspace' },
    ])
  })

  it('finds prev-next links correctly', () => {
    const { prev, next } = getPrevNextLinks('/docs/workspace/analysis', allLinks)
    
    expect(prev?.href).toBe('/docs/workspace')
    expect(next?.href).toBe('/docs/workspace/workspace')
  })

  it('handles start and end of links for prev-next', () => {
    const first = getPrevNextLinks('/docs', allLinks)
    expect(first.prev).toBeNull()
    expect(first.next?.href).toBe('/docs/workspace')

    const last = getPrevNextLinks('/docs/workspace/workspace', allLinks)
    expect(last.prev?.href).toBe('/docs/workspace/analysis')
    expect(last.next).toBeNull()
  })
})


