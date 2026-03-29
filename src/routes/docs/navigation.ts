import type { Component } from 'svelte'

const docSectionNames: Readonly<Record<string, string>> = {
  basic: 'Basic Usage',
  'upload-data': 'Uploading Data',
  export: 'Export',
  advanced: 'Advanced',
}

const docSectionPriority = [
  'Getting Started',
  'Uploading Data',
  'Basic Usage',
  'Export',
  'Advanced',
] as const

export interface DocFrontmatter {
  title?: string
  description?: string
  order?: number
  seoTitle?: string
}

export interface LoadedDocMetadata {
  title: string
  description?: string
  order?: number
  seoTitle: string
}

export interface LoadedDoc {
  path: string
  slug: string
  metadata: LoadedDocMetadata
  component: Component<Record<string, unknown>>
}

export interface DocLink {
  name: string
  href: string
  order: number
  slug: string
}

export interface DocSection {
  title: string
  links: DocLink[]
}

export interface DocNavigationData {
  sections: DocSection[]
  allLinks: DocLink[]
}

export interface DocBreadcrumb {
  name: string
  href: string
}

export interface DocModule {
  default: Component<Record<string, unknown>>
  metadata?: DocFrontmatter
}

export function formatDocSegmentName(segment: string): string {
  return segment.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

export function normalizeDocSlug(slug: string): string {
  const trimmedSlug = slug.replace(/^\/+|\/+$/g, '')

  if (trimmedSlug === 'index') {
    return ''
  }

  if (trimmedSlug.endsWith('/index')) {
    return trimmedSlug.replace(/\/index$/, '')
  }

  return trimmedSlug
}

export function normalizeDocPath(path: string): string {
  if (path === '/') {
    return path
  }

  const normalizedPath = path.replace(/\/+$/, '')
  return normalizedPath || '/'
}

export function getDocHref(slug: string): string {
  return `/docs/${slug}`
}

export function isMatchingDocPath(href: string, pathname: string): boolean {
  return normalizeDocPath(href) === normalizeDocPath(pathname)
}

export function getDefaultDocTitle(slug: string): string {
  if (slug === '') {
    return 'Introduction'
  }

  const fileName = slug.split('/').pop()
  return fileName ? formatDocSegmentName(fileName) : 'Introduction'
}

export function getDocSectionTitle(slug: string): string {
  if (slug === '') {
    return 'Getting Started'
  }

  const parts = slug.split('/')
  if (parts.length === 1) {
    return docSectionNames[slug] ?? 'General'
  }

  return docSectionNames[parts[0]] ?? formatDocSegmentName(parts[0])
}

export function getDocLinkName(doc: Pick<LoadedDoc, 'slug' | 'metadata'>): string {
  return doc.slug === '' ? 'Introduction' : doc.metadata.title
}

export function buildDocNavigation(docs: readonly LoadedDoc[]): DocNavigationData {
  const sectionsMap = new Map<string, DocLink[]>()

  for (const doc of docs) {
    const sectionTitle = getDocSectionTitle(doc.slug)
    const links = sectionsMap.get(sectionTitle) ?? []

    links.push({
      name: getDocLinkName(doc),
      href: getDocHref(doc.slug),
      order: doc.metadata.order ?? 99,
      slug: doc.slug,
    })

    sectionsMap.set(sectionTitle, links)
  }

  const sections = Array.from(sectionsMap.entries()).map(([title, links]) => ({
    title,
    links: links.sort(
      (left, right) => left.order - right.order || left.name.localeCompare(right.name)
    ),
  }))

  sections.sort((left, right) => {
    const leftIndex = docSectionPriority.indexOf(left.title as (typeof docSectionPriority)[number])
    const rightIndex = docSectionPriority.indexOf(
      right.title as (typeof docSectionPriority)[number]
    )

    if (leftIndex !== -1 && rightIndex !== -1) {
      return leftIndex - rightIndex
    }

    if (leftIndex !== -1) {
      return -1
    }

    if (rightIndex !== -1) {
      return 1
    }

    return left.title.localeCompare(right.title)
  })

  return {
    sections,
    allLinks: sections.flatMap(section => section.links),
  }
}

export function buildDocBreadcrumbs(
  pathname: string,
  sections: readonly DocSection[]
): DocBreadcrumb[] {
  const breadcrumbs: DocBreadcrumb[] = [
    { name: 'GazePlotter', href: '/' },
    { name: 'Docs', href: '/docs' },
  ]

  const docsPath = normalizeDocPath(pathname).replace(/^\/docs\/?/, '')
  if (!docsPath) {
    return breadcrumbs
  }

  const allLinks = sections.flatMap(section => section.links)
  const segments = docsPath.split('/')
  let currentPath = '/docs'

  for (const segment of segments) {
    currentPath += `/${segment}`

    const matchedLink = allLinks.find(link =>
      isMatchingDocPath(link.href, currentPath)
    )

    breadcrumbs.push({
      name: matchedLink?.name ?? docSectionNames[segment] ?? formatDocSegmentName(segment),
      href: currentPath,
    })
  }

  return breadcrumbs
}

export function getPrevNextLinks(
  pathname: string,
  links: readonly DocLink[]
): { prev: DocLink | null; next: DocLink | null } {
  const currentIndex = links.findIndex(link => isMatchingDocPath(link.href, pathname))

  return {
    prev: currentIndex > 0 ? links[currentIndex - 1] : null,
    next:
      currentIndex >= 0 && currentIndex < links.length - 1
        ? links[currentIndex + 1]
        : null,
  }
}
