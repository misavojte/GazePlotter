import { error } from '@sveltejs/kit'
import { getDoc } from '../docs'

import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params }) => {
  const doc = await getDoc(params.slug)

  if (!doc) {
    throw error(404, 'Document not found')
  }

  return {
    doc,
  }
}
