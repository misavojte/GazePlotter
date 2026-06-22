import { SquarePlus, Undo2, Redo2, RotateCcw, Settings2 } from 'lucide-svelte'
import type { LucideIconComponent } from '$lib/shared/types'
import { PLOT_GROUPS, type PlotGroup } from '$lib/plots/groups'

export interface RailVisualization {
  id: string
  label: string
  group: PlotGroup
}

export interface RailActionConfig {
  label: string
  run?: () => void
  /** When present, this action is a submenu parent: it carries no `run`, and
   *  its children render as a nested menu. The add-visualization menu uses this
   *  to group plots under their taxonomy bucket. */
  children?: RailActionConfig[]
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
  onAddVisualization: (id: string) => void
}

type RailItemId =
  | 'undo'
  | 'redo'
  | 'reset-layout'
  | 'add-visualization'
  | 'edit-plot'

const railIcons = {
  undo: Undo2,
  redo: Redo2,
  'reset-layout': RotateCcw,
  'add-visualization': SquarePlus,
  'edit-plot': Settings2,
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
      // One submenu parent per non-empty taxonomy group, in PLOT_GROUPS order.
      // Capability filtering happens upstream, so an unavailable group simply
      // contributes no items and drops out here.
      actions: PLOT_GROUPS.flatMap(group => {
        const items = options.visualizations.filter(v => v.group === group.key)
        if (items.length === 0) return []
        return [
          {
            label: group.label,
            children: items.map(visualization => ({
              label: visualization.label,
              run: () => options.onAddVisualization(visualization.id),
            })),
          },
        ]
      }),
      disabled: options.isProcessing || !options.isValidData,
    },
  ]
}

// Mobile-only: when a plot is selected but the settings sheet isn't
// open yet, the rail swaps its contents to a single Edit action that
// opens the sheet. Desktop never enters this state (selection opens
// the pane atomically there).
export function createEditPlotRailItem(
  onEdit: () => void
): RailItemConfig {
  return {
    id: 'edit-plot',
    label: 'Edit plot settings',
    icon: railIcons['edit-plot'],
    actions: [{ label: 'Edit plot settings', run: onEdit }],
    disabled: false,
  }
}
