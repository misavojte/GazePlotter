import { SIDEBAR, type SidebarSection, type SidebarLink, type SidebarItem } from './sidebarConfig'

export interface DocNavigationData {
  sections: readonly SidebarItem[]
  allLinks: readonly SidebarLink[]
}

export async function load(): Promise<DocNavigationData> {
  const allLinks = SIDEBAR.flatMap(item => 'links' in item ? item.links : [item])

  return {
    sections: SIDEBAR,
    allLinks
  }
}
