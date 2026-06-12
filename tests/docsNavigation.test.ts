import { describe, expect, it } from 'vitest'
import {
  buildDocBreadcrumbs,
  getPrevNextLinks,
  normalizeDocPath,
} from '../src/routes/docs/navigation'
import type { SidebarSection, SidebarLink } from '../src/routes/docs/sidebarConfig'

const mockSections: readonly SidebarSection[] = [
  {
    title: 'Getting Started',
    links: [
      { name: 'Introduction', href: '/docs' }
    ]
  },
  {
    title: 'Workspace & Setup',
    links: [
      { name: 'Overview', breadcrumbName: 'Workspace & Setup', href: '/docs/setup' },
      { name: 'Analysis', href: '/docs/setup/analysis' },
      { name: 'Workspace', href: '/docs/setup/workspace' }
    ]
  }

] as const

const allLinks: readonly SidebarLink[] = mockSections.flatMap(s => s.links)

describe('docs navigation helpers', () => {
  it('normalizes docs paths', () => {
    expect(normalizeDocPath('/docs/')).toBe('/docs')
    expect(normalizeDocPath('/docs/setup/')).toBe('/docs/setup')
    expect(normalizeDocPath('/')).toBe('/')
  })

  it('derives breadcrumbs correctly', () => {
    const breadcrumbs = buildDocBreadcrumbs('/docs/setup/workspace', mockSections)
    
    expect(breadcrumbs).toEqual([
      { name: 'GazePlotter', href: '/' },
      { name: 'Docs', href: '/docs' },
      { name: 'Workspace & Setup', href: '/docs/setup' },
      { name: 'Workspace', href: '/docs/setup/workspace' },
    ])
  })

  it('finds prev-next links correctly', () => {
    const { prev, next } = getPrevNextLinks('/docs/setup/analysis', allLinks)
    
    expect(prev?.href).toBe('/docs/setup')
    expect(next?.href).toBe('/docs/setup/workspace')
  })

  it('handles start and end of links for prev-next', () => {
    const first = getPrevNextLinks('/docs', allLinks)
    expect(first.prev).toBeNull()
    expect(first.next?.href).toBe('/docs/setup')

    const last = getPrevNextLinks('/docs/setup/workspace', allLinks)
    expect(last.prev?.href).toBe('/docs/setup/analysis')
    expect(last.next).toBeNull()
  })
})


