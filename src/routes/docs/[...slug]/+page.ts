import { error, redirect } from '@sveltejs/kit'
import { getDoc } from '../docs'

import type { PageLoad } from './$types'

const REDIRECTS: Record<string, string> = {
  'export/aggregated-data': '/docs/export/metric-data',
  'export/scanpath-similarity': '/docs/export/metric-data',
  'basic': '/docs/workspace',
  'basic/workspace': '/docs/workspace/workspace',
  'basic/aoi-customization': '/docs/workspace/aoi-library',
  'basic/event-customization': '/docs/workspace/event-library',
  'basic/groups': '/docs/workspace/participant-library',
  'basic/participants-customization': '/docs/workspace/participant-library',
  'basic/stimuli-customization': '/docs/workspace/stimuli-library',
  'basic/scarf-plot': '/docs/visualizations/scarf-plot',
  'basic/transition-matrix': '/docs/visualizations/transition-matrix',
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
