import { SIDEBAR } from '../docs/sidebarConfig'

export const prerender = true

export async function GET() {
  const baseUrl = 'https://gazeplotter.com'

  let md = `# GazePlotter Documentation\n\n`
  md += `> GazePlotter is a free web application for eye-tracking data analysis and visualization. Built with a commitment to open science, GazePlotter transforms complex gaze data into intuitive, interactive visualizations without requiring registration, subscriptions, or server uploads.\n\n`

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
