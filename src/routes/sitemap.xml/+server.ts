import { SIDEBAR } from '../docs/sidebarConfig'

export const prerender = true

export async function GET() {
  const baseUrl = 'https://gazeplotter.com'

  // Standard static pages
  const urls: string[] = [
    '',        // Homepage
  ]

  // Add all documentation pages from the sidebar configuration
  for (const section of SIDEBAR) {
    for (const link of section.links) {
      let path = link.href
      if (path.startsWith('/')) {
        path = path.slice(1)
      }
      urls.push(path)
    }
  }

  // Deduplicate and filter empty elements or unwanted entries
  const uniqueUrls = Array.from(new Set(urls))

  // Construct XML response
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<urlset
  xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="https://www.sitemaps.org/schemas/sitemap/0.9
  https://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd"
>
  ${uniqueUrls
    .map((url) => {
      // In +layout.ts, trailingSlash = 'always' is set.
      // So all pages end with a trailing slash except the root itself.
      const formattedUrl = url === '' ? '' : (url.endsWith('/') ? url : `${url}/`)
      const isDocs = url.startsWith('docs')
      const changefreq = isDocs ? 'weekly' : 'monthly'
      const priority = url === '' ? '1.0' : (isDocs ? '0.8' : '0.5')

      return `
  <url>
    <loc>${baseUrl}/${formattedUrl}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
    })
    .join('')}
</urlset>`

  return new Response(xml.trim(), {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}
