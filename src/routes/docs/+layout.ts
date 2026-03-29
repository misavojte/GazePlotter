import { getDocs } from './docs'
import { buildDocNavigation, type DocNavigationData } from './navigation'

export async function load(): Promise<DocNavigationData> {
  const allDocs = await getDocs()
  return buildDocNavigation(allDocs)
}
