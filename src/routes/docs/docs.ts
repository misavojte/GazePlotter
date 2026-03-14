import {
  getDefaultDocTitle,
  normalizeDocSlug,
  type DocModule,
  type LoadedDoc,
  type LoadedDocMetadata,
} from './navigation'

export async function getDocs(): Promise<LoadedDoc[]> {
  const modules = import.meta.glob<DocModule>('/docs/**/*.md')
  const rawModules = import.meta.glob<string>('/docs/**/*.md', {
    query: '?raw',
    import: 'default',
  })
  const docs: LoadedDoc[] = []

  for (const [path, resolver] of Object.entries(modules)) {
    const slug = normalizeDocSlug(path.replace('/docs/', '').replace('.md', ''))
    const content = await resolver()
    const metadata = { ...content.metadata }

    // If no title in frontmatter, try to find it in the content (H1)
    if (!metadata.title) {
      metadata.title = getDefaultDocTitle(slug)
    }

    // SEO Title
    metadata.seoTitle = `${metadata.title} | GazePlotter Docs`

    // Description fallback from the first paragraph
    if (!metadata.description) {
      const rawResolver = rawModules[path] as () => Promise<string>
      const rawContent = (await rawResolver()) || ''

      // Remove frontmatter
      const contentWithoutFrontmatter = rawContent.replace(
        /^---[\s\S]*?---\n?/,
        ''
      )

      // Find first paragraph (non-empty line that doesn't start with #, !, or :::)
      const lines = contentWithoutFrontmatter.split('\n')
      let firstParagraph = ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (
          trimmed &&
          !trimmed.startsWith('#') &&
          !trimmed.startsWith('!') &&
          !trimmed.startsWith(':')
        ) {
          firstParagraph = trimmed
          break
        }
      }

      // Clean markdown from description and limit length
      metadata.description = firstParagraph
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Strip links [text](url) -> text
        .replace(/[*_`]/g, '') // Strip basic formatting *, _, `
        .trim()
        .slice(0, 160)
    }

    const loadedMetadata: LoadedDocMetadata = {
      title: metadata.title,
      description: metadata.description,
      order: metadata.order,
      seoTitle: metadata.seoTitle,
    }

    docs.push({
      path,
      slug,
      metadata: loadedMetadata,
      component: content.default,
    })
  }

  return docs
}

export async function getDoc(
  slug: string
): Promise<Pick<LoadedDoc, 'component' | 'metadata'> | null> {
  const docs = await getDocs()

  // Normalize lookup slug to remove trailing slash for consistent matching
  // (Since getDocs generates slugs without trailing slashes)
  const normalizedSlug = slug.endsWith('/') ? slug.slice(0, -1) : slug

  const doc = docs.find(d => d.slug === normalizedSlug)

  if (!doc) return null

  return {
    component: doc.component,
    metadata: doc.metadata,
  }
}
