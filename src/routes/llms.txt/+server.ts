import { SIDEBAR } from '../docs/sidebarConfig'

export const prerender = true

export async function GET() {
  const baseUrl = 'https://gazeplotter.com'

  let md = `# GazePlotter Documentation\n\n`
  md += `> Free, open-source, serverless web app for client-side eye-tracking analysis. Data is processed locally in the browser with absolute privacy (no server uploads). No registration or subscriptions required.\n\n`

  for (const item of SIDEBAR) {
    if ('links' in item) {
      md += `## ${item.title}\n\n`
      for (const link of item.links) {
        const fullUrl = `${baseUrl}${link.href.endsWith('/') ? link.href : `${link.href}/`}`
        md += `- [${link.name}](${fullUrl}): ${link.description || ''}\n`
      }
      md += `\n`
    } else {
      const fullUrl = `${baseUrl}${item.href.endsWith('/') ? item.href : `${item.href}/`}`
      md += `- [${item.name}](${fullUrl}): ${item.description || ''}\n\n`
    }
  }

  return new Response(md.trim(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
