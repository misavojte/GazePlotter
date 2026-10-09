import { SIDEBAR } from '../docs/sidebarConfig'

export const prerender = true

export async function GET() {
  const baseUrl = 'https://gazeplotter.com'

  let md = `# GazePlotter Documentation\n\n`
  md += `> Free, open-source, serverless web app for client-side eye-tracking analysis. Data is processed locally in the browser with absolute privacy (no server uploads). No registration or subscriptions required.\n\n`
  md += `Peer-reviewed. Cite as: Vojtechovska, M., Popelka, S. GazePlotter: An open-source solution for the automatic generation of scarf plots from eye-tracking data. Behav Res 58, 85 (2026). https://doi.org/10.3758/s13428-026-02959-5\n\n`

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
