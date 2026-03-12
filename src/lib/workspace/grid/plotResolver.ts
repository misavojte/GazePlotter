import type { Component } from 'svelte'
import { getVizConfig } from '$lib/plots/registry'
import type { AllGridTypes } from '$lib/workspace/type/gridType'
import type {
  WorkspaceCommand,
  WorkspaceCommandChain,
} from '$lib/workspace/commands'

export type WorkspacePlotDispatcher = (
  command: WorkspaceCommand | WorkspaceCommandChain
) => void

export type WorkspacePlotComponent = Component<{
  item: AllGridTypes
  onWorkspaceCommand?: WorkspacePlotDispatcher
}>

export type WorkspacePlotDefinition = {
  component: WorkspacePlotComponent
  name: string
}

export function getWorkspacePlotLabel(item: AllGridTypes): string {
  try {
    const visConfig = getVizConfig(item.type as any) as
      | { name?: string }
      | undefined

    return typeof visConfig?.name === 'string' ? visConfig.name : item.type
  } catch {
    return item.type
  }
}

export function resolveWorkspacePlotDefinition(
  item: AllGridTypes
): WorkspacePlotDefinition {
  const visConfig = getVizConfig(item.type as any) as
    | { component?: WorkspacePlotComponent; name?: string }
    | undefined

  if (!visConfig || !visConfig.component || typeof visConfig.name !== 'string') {
    throw new Error(`Plot type "${item.type}" is not registered.`)
  }

  return {
    component: visConfig.component,
    name: visConfig.name,
  }
}
