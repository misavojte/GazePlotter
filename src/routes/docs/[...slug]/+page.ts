import { error } from '@sveltejs/kit'
import { getDoc } from '../docs'

export async function load({ params }) {
  const doc = await getDoc(params.slug)

  if (!doc) {
    throw error(404, 'Document not found')
  }

  return {
    doc,
  }
}
