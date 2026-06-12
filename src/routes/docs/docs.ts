import type { Component } from 'svelte'
import { SIDEBAR } from './sidebarConfig'

export interface LoadedDocMetadata {
  title: string
  seoTitle: string
  description?: string
}

export interface LoadedDoc {
  component: Component<Record<string, unknown>>
  metadata: LoadedDocMetadata
}

// Map that matches raw routes to our dynamically imported svelte components
type DocModule = { default: Component<Record<string, unknown>> }
const modules = import.meta.glob<DocModule>('/docs/**/*.md')

export async function getDoc(
  slug: string
): Promise<LoadedDoc | null> {
  const normalizedSlug = slug.endsWith('/') ? slug.slice(0, -1) : slug
  
  // Find metadata from SIDEBAR config
  let metadata: LoadedDocMetadata = {
    title: 'Unknown',
    seoTitle: 'Unknown | GazePlotter Docs'
  }
  
  const hrefToMatch = `/docs${normalizedSlug ? `/${normalizedSlug}` : ''}`
  const allLinks = SIDEBAR.flatMap(item => 'links' in item ? item.links : [item])
  const link = allLinks.find(l => l.href === hrefToMatch)
  if (link) {
    metadata = {
      title: link.name,
      seoTitle: `${link.name} | GazePlotter Docs`,
      description: link.description
    }
  }

  // Find the file path from the glob keys
  let path = `/docs/${normalizedSlug}.md`
  if (normalizedSlug === '') path = '/docs/index.md'
  
  // Just in case it's a folder with an index
  if (!modules[path]) {
    path = `/docs/${normalizedSlug}/index.md`
  }

  const resolver = modules[path]
  if (!resolver) return null

  const content = await resolver()

  return {
    component: content.default,
    metadata
  }
}
