import { getDocs } from './docs'

const sectionNames: Record<string, string> = {
  basic: 'Basic Usage',
  'upload-data': 'Uploading Data',
  export: 'Export',
  advanced: 'Advanced',
}

export async function load() {
  const allDocs = await getDocs()

  // Filter out 'index' files from being separate links if they are section heads
  // but keep the root index as 'Introduction'
  const sectionsMap = new Map()

  allDocs.forEach(doc => {
    const parts = doc.slug.split('/')
    let sectionTitle = 'General'

    const sectionKey = parts.length > 1 ? parts[0] : ''
    sectionTitle = sectionNames[sectionKey] || 'General'

    if (doc.slug === '') {
      sectionTitle = 'Getting Started'
    } else if (parts.length === 1) {
      // If it's a top-level file (e.g. basic.md), it's its own section head
      sectionTitle = sectionNames[doc.slug] || 'General'
    } else if (parts.length > 1) {
      sectionTitle =
        sectionNames[parts[0]] ||
        parts[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }

    if (!sectionsMap.has(sectionTitle)) {
      sectionsMap.set(sectionTitle, [])
    }

    // Determine link name
    let name = doc.metadata.title
    if (doc.slug === '') name = 'Introduction'

    // Add to mapping
    sectionsMap.get(sectionTitle).push({
      name,
      href: `/docs/${doc.slug}`,
      order: doc.metadata.order || 99,
      slug: doc.slug,
    })
  })

  const sections = Array.from(sectionsMap.entries()).map(([title, links]) => ({
    title,
    links: links.sort(
      (a: any, b: any) => a.order - b.order || a.name.localeCompare(b.name)
    ),
  }))

  // Sort sections
  const sectionPriority = [
    'Getting Started',
    'Uploading Data',
    'Basic Usage',
    'Export',
    'Advanced',
  ]
  sections.sort((a: any, b: any) => {
    const aIndex = sectionPriority.indexOf(a.title)
    const bIndex = sectionPriority.indexOf(b.title)
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    return a.title.localeCompare(b.title)
  })

  // Flat ordered list for prev/next navigation
  const allLinks = sections.flatMap(s => s.links)

  return {
    sections,
    allLinks,
  }
}
