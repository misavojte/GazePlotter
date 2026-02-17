export async function getDocs() {
  const modules = import.meta.glob('/docs/**/*.md')
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
  const doc = docs.find(d => d.slug === slug)

  if (!doc) return null

  return {
    component: doc.component,
    metadata: doc.metadata,
  }
}
