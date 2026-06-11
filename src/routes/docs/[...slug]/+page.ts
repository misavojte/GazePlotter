import { error, redirect } from '@sveltejs/kit'
import { getDoc } from '../docs'

import type { PageLoad } from './$types'

const REDIRECTS: Record<string, string> = {
  'basic/bar-plot': '/docs/visualizations/aoi-metrics',
  'basic/scarf-plot': '/docs/visualizations/scarf-plot',
  'basic/transition-matrix': '/docs/visualizations/transition-matrix',
  'basic/aoi-occupancy': '/docs/visualizations/aoi-occupancy',
  'basic/recurrence-plot': '/docs/visualizations/recurrence-plot'
}

export const load: PageLoad = async ({ params }) => {
  const slug = params.slug.endsWith('/') ? params.slug.slice(0, -1) : params.slug
  if (slug in REDIRECTS) {
    throw redirect(308, REDIRECTS[slug])
  }

  const doc = await getDoc(params.slug)

  if (!doc) {
    throw error(404, 'Document not found')
  }

  return {
    doc,
  }
}
