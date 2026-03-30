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
    title: 'Basic Usage',
    links: [
      { name: 'Basic', href: '/docs/basic' },
      { name: 'Analysis', href: '/docs/basic/analysis' },
      { name: 'Workspace', href: '/docs/basic/workspace' }
    ]
  }

] as const

const allLinks: readonly SidebarLink[] = mockSections.flatMap(s => s.links)

describe('docs navigation helpers', () => {
  it('normalizes docs paths', () => {
    expect(normalizeDocPath('/docs/')).toBe('/docs')
    expect(normalizeDocPath('/docs/basic/')).toBe('/docs/basic')
    expect(normalizeDocPath('/')).toBe('/')
  })

  it('derives breadcrumbs correctly', () => {
    const breadcrumbs = buildDocBreadcrumbs('/docs/basic/workspace', mockSections)
    
    expect(breadcrumbs).toEqual([
      { name: 'GazePlotter', href: '/' },
      { name: 'Docs', href: '/docs' },
      { name: 'Basic', href: '/docs/basic' },
      { name: 'Workspace', href: '/docs/basic/workspace' },
    ])
  })

  it('finds prev-next links correctly', () => {
    const { prev, next } = getPrevNextLinks('/docs/basic/analysis', allLinks)
    
    expect(prev?.href).toBe('/docs/basic')
    expect(next?.href).toBe('/docs/basic/workspace')
  })

  it('handles start and end of links for prev-next', () => {
    const first = getPrevNextLinks('/docs', allLinks)
    expect(first.prev).toBeNull()
    expect(first.next?.href).toBe('/docs/basic')

    const last = getPrevNextLinks('/docs/basic/workspace', allLinks)
    expect(last.prev?.href).toBe('/docs/basic/analysis')
    expect(last.next).toBeNull()
  })
})


