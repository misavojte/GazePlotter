import { SIDEBAR, type SidebarSection, type SidebarLink } from './sidebarConfig'

export interface DocNavigationData {
  sections: readonly SidebarSection[]
  allLinks: readonly SidebarLink[]
}

export async function load(): Promise<DocNavigationData> {
  const allLinks = SIDEBAR.flatMap(item => 'links' in item ? item.links : [item])

  return {
    sections: SIDEBAR,
    allLinks
  }
}
