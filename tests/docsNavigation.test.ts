import { describe, expect, it } from 'vitest'
import type { Component } from 'svelte'
import {
  buildDocBreadcrumbs,
  buildDocNavigation,
  getPrevNextLinks,
  normalizeDocSlug,
  type LoadedDoc,
} from '../src/routes/docs/navigation'

const mockComponent = {} as unknown as Component<Record<string, unknown>>

const docs: LoadedDoc[] = [
  {
    path: '/docs/index.md',
    slug: '',
    metadata: {
      title: 'Home',
      seoTitle: 'Home | GazePlotter Docs',
      order: 0,
    },
    component: mockComponent,
  },
  {
    path: '/docs/upload-data.md',
    slug: 'upload-data',
    metadata: {
      title: 'Upload Overview',
      seoTitle: 'Upload Overview | GazePlotter Docs',
      order: 1,
    },
    component: mockComponent,
  },
  {
    path: '/docs/basic/analysis.md',
    slug: 'basic/analysis',
    metadata: {
      title: 'Analysis',
      seoTitle: 'Analysis | GazePlotter Docs',
      order: 1,
    },
    component: mockComponent,
  },
  {
    path: '/docs/basic/workspace.md',
    slug: 'basic/workspace',
    metadata: {
      title: 'Workspace',
      seoTitle: 'Workspace | GazePlotter Docs',
      order: 2,
    },
    component: mockComponent,
  },
  {
    path: '/docs/advanced/tricks.md',
    slug: 'advanced/tricks',
    metadata: {
      title: 'Tricks',
      seoTitle: 'Tricks | GazePlotter Docs',
      order: 1,
    },
    component: mockComponent,
  },
  {
    path: '/docs/custom/deep-topic.md',
    slug: 'custom/deep-topic',
    metadata: {
      title: 'Deep Topic',
      seoTitle: 'Deep Topic | GazePlotter Docs',
      order: 1,
    },
    component: mockComponent,
  },
]

describe('docs navigation helpers', () => {
  it('normalizes docs index slugs', () => {
    expect(normalizeDocSlug('index')).toBe('')
    expect(normalizeDocSlug('basic/index')).toBe('basic')
    expect(normalizeDocSlug('/advanced/tricks/')).toBe('advanced/tricks')
  })

  it('builds ordered sections and flat navigation links', () => {
    const result = buildDocNavigation(docs)

    expect(result.sections.map(section => section.title)).toEqual([
      'Getting Started',
      'Uploading Data',
      'Basic Usage',
      'Advanced',
      'Custom',
    ])
    expect(result.sections[2].links.map(link => link.name)).toEqual([
      'Analysis',
      'Workspace',
    ])
    expect(result.allLinks.map(link => link.slug)).toEqual([
      '',
      'upload-data',
      'basic/analysis',
      'basic/workspace',
      'advanced/tricks',
      'custom/deep-topic',
    ])
  })

  it('derives breadcrumbs and prev-next links from shared navigation data', () => {
    const navigation = buildDocNavigation(docs)

    expect(
      buildDocBreadcrumbs('/docs/basic/workspace/', navigation.sections)
    ).toEqual([
      { name: 'GazePlotter', href: '/' },
      { name: 'Docs', href: '/docs' },
      { name: 'Basic Usage', href: '/docs/basic' },
      { name: 'Workspace', href: '/docs/basic/workspace' },
    ])
    expect(
      buildDocBreadcrumbs('/docs/upload-data', navigation.sections)
    ).toEqual([
      { name: 'GazePlotter', href: '/' },
      { name: 'Docs', href: '/docs' },
      { name: 'Upload Overview', href: '/docs/upload-data' },
    ])
    expect(getPrevNextLinks('/docs/basic/workspace', navigation.allLinks)).toEqual({
      prev: navigation.allLinks[2],
      next: navigation.allLinks[4],
    })
  })
})
