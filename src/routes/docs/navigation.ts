import type { SidebarItem, SidebarLink } from './sidebarConfig'

export interface DocBreadcrumb {
  name: string
  href: string
}

export function normalizeDocPath(path: string): string {
  if (path === '/') {
    return path
  }

  const normalizedPath = path.replace(/\/+$/, '')
  return normalizedPath || '/'
}

export function isMatchingDocPath(href: string, pathname: string): boolean {
  return normalizeDocPath(href) === normalizeDocPath(pathname)
}

export function buildDocBreadcrumbs(
  pathname: string,
  sections: readonly SidebarItem[]
): DocBreadcrumb[] {
  const breadcrumbs: DocBreadcrumb[] = [
    { name: 'GazePlotter', href: '/' },
    { name: 'Docs', href: '/docs' },
  ]

  const docsPath = normalizeDocPath(pathname).replace(/^\/docs\/?/, '')
  if (!docsPath) {
    return breadcrumbs
  }

  const allLinks = sections.flatMap(item => 'links' in item ? item.links : [item])
  const segments = docsPath.split('/')
  let currentPath = '/docs'

  for (const segment of segments) {
    currentPath += `/${segment}`

    const matchedLink = allLinks.find(link =>
      isMatchingDocPath(link.href, currentPath)
    )
    
    // In our simplified structure we rely on matchedLink, but if not found we format it
    breadcrumbs.push({
      name: matchedLink?.breadcrumbName ?? matchedLink?.name ?? formatDocSegmentName(segment),
      href: currentPath,
    })
  }

  return breadcrumbs
}

function formatDocSegmentName(segment: string): string {
  return segment.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

export function getPrevNextLinks(
  pathname: string,
  links: readonly SidebarLink[]
): { prev: SidebarLink | null; next: SidebarLink | null } {
  const currentIndex = links.findIndex(link => isMatchingDocPath(link.href, pathname))

  return {
    prev: currentIndex > 0 ? links[currentIndex - 1] : null,
    next:
      currentIndex >= 0 && currentIndex < links.length - 1
        ? links[currentIndex + 1]
        : null,
  }
}
