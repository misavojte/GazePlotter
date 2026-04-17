import type { WorkspaceCommand, WorkspaceCommandChain } from './types'
import type { GridItemBase, PlotType } from '$lib/workspace'

/**
 * Generates a unique chain ID for command chaining.
 * Each command chain represents a sequence of related commands (e.g., original command + collision resolution commands).
 */
let chainIdCounter = 0
export function generateChainId(): number {
  return ++chainIdCounter
}

/**
 * Creates a root command (original user action) with a new chain ID.
 */
export function createRootCommand<T extends WorkspaceCommand>(
  command: T
): WorkspaceCommandChain {
  return {
    ...command,
    chainId: generateChainId(),
    isRootCommand: true,
  }
}

/**
 * Creates a child command (e.g., collision resolution) that inherits the chain ID from its parent.
 */
export function createChildCommand<T extends WorkspaceCommand>(
  command: T,
  parentChainId: number
): WorkspaceCommandChain {
  return {
    ...command,
    chainId: parentChainId,
    isRootCommand: false,
  }
}

export function createCommandSourcePlotPattern(
  settings: Partial<GridItemBase> & { type: PlotType },
  placement: 'plot' | 'modal' | 'workspace' | 'pane'
) {
  return `${settings.type}.${settings.id}.${placement}`
}

// check based on the source pattern if the command is a history command
// (starts with 'undo.' or 'redo.')
export function isHistoryCommand(source: string) {
  return source.startsWith('undo.') || source.startsWith('redo.')
}
