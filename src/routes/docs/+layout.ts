import { SIDEBAR, type SidebarSection, type SidebarLink } from './sidebarConfig'

export interface DocNavigationData {
  sections: readonly SidebarSection[]
  allLinks: readonly SidebarLink[]
}

export async function load(): Promise<DocNavigationData> {
  return {
    sections: SIDEBAR,
    allLinks: SIDEBAR.flatMap(section => section.links)
  }
}
