export async function getDocs() {
  const modules = import.meta.glob('/docs/**/*.md')
  const rawModules = import.meta.glob('/docs/**/*.md', {
    query: '?raw',
    import: 'default',
  })
  const docs = []

  for (const path in modules) {
    let slug = path.replace('/docs/', '').replace('.md', '')

    // Normalize index slugs
    if (slug === 'index') {
      slug = ''
    } else if (slug.endsWith('/index')) {
      slug = slug.replace(/\/index$/, '')
    }

    const resolver = modules[path] as () => Promise<any>
    const content = await resolver()
    const metadata = { ...content.metadata }

    // If no title in frontmatter, try to find it in the content (H1)
    if (!metadata.title) {
      const fileName = slug === '' ? 'index' : slug.split('/').pop()
      if (fileName === 'index' || slug === '') {
        // Use directory name for index files
        const parentDir = slug.split('/').slice(-2, -1)[0] || 'Introduction'
        metadata.title = parentDir
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
      } else {
        metadata.title = fileName
          ?.replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
      }
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

    docs.push({
      path,
      slug,
      metadata,
      component: content.default,
    })
  }

  return docs
}

export async function getDoc(slug: string) {
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
