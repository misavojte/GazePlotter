import FileText from 'lucide-svelte/icons/file-text'
import Plus from 'lucide-svelte/icons/plus'
import Redo2 from 'lucide-svelte/icons/redo-2'
import RotateCcw from 'lucide-svelte/icons/rotate-ccw'
import Undo2 from 'lucide-svelte/icons/undo-2'
import type { LucideIconComponent } from '$lib/shared/types/iconComponent'

export interface WorkspaceToolbarVisualization {
  id: string
  label: string
}

export interface WorkspaceToolbarActionConfig {
  label: string
  run: () => void
}

export interface WorkspaceToolbarItemConfig {
  id: WorkspaceToolbarItemId
  label: string
  icon: LucideIconComponent
  actions: WorkspaceToolbarActionConfig[]
  disabled: boolean
}

interface CreateWorkspaceToolbarItemsOptions {
  undoLabel: string | null
  redoLabel: string | null
  canUndo: boolean
  canRedo: boolean
  isProcessing: boolean
  isValidData: boolean
  visualizations: WorkspaceToolbarVisualization[]
  onUndo: () => void
  onRedo: () => void
  onResetLayout: () => void
  onOpenMetadata: () => void
  onAddVisualization: (id: string) => void
}

type WorkspaceToolbarItemId =
  | 'undo'
  | 'redo'
  | 'reset-layout'
  | 'add-visualization'
  | 'metadata'

const toolbarIcons = {
  undo: Undo2,
  redo: Redo2,
  'reset-layout': RotateCcw,
  'add-visualization': Plus,
  metadata: FileText,
} satisfies Record<WorkspaceToolbarItemId, LucideIconComponent>

export function createWorkspaceToolbarItems(
  options: CreateWorkspaceToolbarItemsOptions
): WorkspaceToolbarItemConfig[] {
  const undoLabel = options.undoLabel ?? 'Nothing to undo'
  const redoLabel = options.redoLabel ?? 'Nothing to redo'

  return [
    {
      id: 'undo',
      label: undoLabel,
      icon: toolbarIcons.undo,
      actions: [{ label: undoLabel, run: options.onUndo }],
      disabled: !options.canUndo,
    },
    {
      id: 'redo',
      label: redoLabel,
      icon: toolbarIcons.redo,
      actions: [{ label: redoLabel, run: options.onRedo }],
      disabled: !options.canRedo,
    },
    {
      id: 'reset-layout',
      label: 'Reset Layout',
      icon: toolbarIcons['reset-layout'],
      actions: [
        {
          label: 'Reset Layout',
          run: options.onResetLayout,
        },
      ],
      disabled: options.isProcessing || !options.isValidData,
    },
    {
      id: 'add-visualization',
      label: 'Add Visualization',
      icon: toolbarIcons['add-visualization'],
      actions: options.visualizations.map(visualization => ({
        label: visualization.label,
        run: () => options.onAddVisualization(visualization.id),
      })),
      disabled: options.isProcessing || !options.isValidData,
    },
    {
      id: 'metadata',
      label: 'Source Metadata',
      icon: toolbarIcons.metadata,
      actions: [
        {
          label: 'Source Metadata',
          run: options.onOpenMetadata,
        },
      ],
      disabled: options.isProcessing,
    },
  ]
}
