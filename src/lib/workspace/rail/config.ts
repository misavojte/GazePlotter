import FileText from 'lucide-svelte/icons/file-text'
import Plus from 'lucide-svelte/icons/plus'
import Redo2 from 'lucide-svelte/icons/redo-2'
import RotateCcw from 'lucide-svelte/icons/rotate-ccw'
import Undo2 from 'lucide-svelte/icons/undo-2'
import type { LucideIconComponent } from '$lib/shared/types'

export interface RailVisualization {
  id: string
  label: string
}

export interface RailActionConfig {
  label: string
  run: () => void
}

export interface RailItemConfig {
  id: RailItemId
  label: string
  icon: LucideIconComponent
  actions: RailActionConfig[]
  disabled: boolean
}

interface CreateRailItemsOptions {
  undoLabel: string | null
  redoLabel: string | null
  canUndo: boolean
  canRedo: boolean
  isProcessing: boolean
  isValidData: boolean
  visualizations: RailVisualization[]
  onUndo: () => void
  onRedo: () => void
  onResetLayout: () => void
  onOpenMetadata: () => void
  onAddVisualization: (id: string) => void
}

type RailItemId =
  | 'undo'
  | 'redo'
  | 'reset-layout'
  | 'add-visualization'
  | 'metadata'

const railIcons = {
  undo: Undo2,
  redo: Redo2,
  'reset-layout': RotateCcw,
  'add-visualization': Plus,
  metadata: FileText,
} satisfies Record<RailItemId, LucideIconComponent>

export function createRailItems(
  options: CreateRailItemsOptions
): RailItemConfig[] {
  const undoLabel = options.undoLabel ?? 'Nothing to undo'
  const redoLabel = options.redoLabel ?? 'Nothing to redo'

  return [
    {
      id: 'undo',
      label: undoLabel,
      icon: railIcons.undo,
      actions: [{ label: undoLabel, run: options.onUndo }],
      disabled: !options.canUndo,
    },
    {
      id: 'redo',
      label: redoLabel,
      icon: railIcons.redo,
      actions: [{ label: redoLabel, run: options.onRedo }],
      disabled: !options.canRedo,
    },
    {
      id: 'reset-layout',
      label: 'Reset Layout',
      icon: railIcons['reset-layout'],
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
      icon: railIcons['add-visualization'],
      actions: options.visualizations.map(visualization => ({
        label: visualization.label,
        run: () => options.onAddVisualization(visualization.id),
      })),
      disabled: options.isProcessing || !options.isValidData,
    },
    {
      id: 'metadata',
      label: 'Source Metadata',
      icon: railIcons.metadata,
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
