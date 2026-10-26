import { Grid2x2Plus, Undo2, Redo2, Settings2 } from 'lucide-svelte'
import type { LucideIconComponent } from '$lib/shared/icon'
import type { MenuItem } from '$lib/context-menu'
import { PLOT_GROUPS, type PlotGroup } from '$lib/plots/groups'
import type { PlotType } from '$lib/workspace/grid/types'
import { withShortcut } from '$lib/workspace/keys'

export interface ControlVisualization {
  id: PlotType
  label: string
  detail?: string
  group: PlotGroup
}

export interface ControlAction {
  label: string
  /** Muted second line in the menu. */
  detail?: string
  run?: () => void
  /** When present, this action is a submenu parent: it carries no `run`, and
   *  its children render as a nested menu. The add-visualization menu uses this
   *  to group plots under their taxonomy bucket. */
  children?: ControlAction[]
}

export interface ControlConfig {
  id: ControlId
  label: string
  icon: LucideIconComponent
  actions: ControlAction[]
  disabled: boolean
}

interface CreateToolControlsOptions {
  undoLabel: string | null
  redoLabel: string | null
  canUndo: boolean
  canRedo: boolean
  isProcessing: boolean
  isValidData: boolean
  /** One plot is selected: a new plot takes its stimulus and participants. */
  inheritsSelection?: boolean
  visualizations: ControlVisualization[]
  onUndo: () => void
  onRedo: () => void
  onAddVisualization: (id: PlotType) => void
}

type ControlId =
  | 'undo'
  | 'redo'
  | 'add-visualization'
  | 'edit-plot'

const controlIcons = {
  undo: Undo2,
  redo: Redo2,
  'add-visualization': Grid2x2Plus,
  'edit-plot': Settings2,
} satisfies Record<ControlId, LucideIconComponent>

export function createToolControls(
  options: CreateToolControlsOptions
): ControlConfig[] {
  const undoLabel = options.undoLabel ?? 'Nothing to undo'
  const redoLabel = options.redoLabel ?? 'Nothing to redo'

  return [
    {
      id: 'undo',
      label: options.canUndo ? withShortcut(undoLabel, 'undo') : undoLabel,
      icon: controlIcons.undo,
      actions: [{ label: undoLabel, run: options.onUndo }],
      // Processing gates every workspace action alike: the load replaces the
      // grid and its history, so there is nothing to undo into.
      disabled: options.isProcessing || !options.canUndo,
    },
    {
      id: 'redo',
      label: options.canRedo ? withShortcut(redoLabel, 'redo') : redoLabel,
      icon: controlIcons.redo,
      actions: [{ label: redoLabel, run: options.onRedo }],
      disabled: options.isProcessing || !options.canRedo,
    },
    {
      id: 'add-visualization',
      // Like "Nothing to undo": a disabled control says why.
      label: !options.isValidData
        ? 'Add Visualization (load data first)'
        : options.inheritsSelection
          ? "Add Visualization (with the selected plot's stimulus and participants)"
          : 'Add Visualization',
      icon: controlIcons['add-visualization'],
      actions: addVisualizationActions(options.visualizations, options.onAddVisualization),
      disabled: options.isProcessing || !options.isValidData,
    },
  ]
}

/**
 * One submenu parent per non-empty taxonomy group, in PLOT_GROUPS order.
 * Capability filtering happens upstream, so an unavailable group simply
 * contributes no items and drops out here.
 */
export function addVisualizationActions(
  visualizations: ControlVisualization[],
  onAdd: (id: PlotType) => void
): ControlAction[] {
  return PLOT_GROUPS.flatMap(group => {
    const items = visualizations.filter(v => v.group === group.key)
    if (items.length === 0) return []
    return [
      {
        label: group.label,
        children: items.map(visualization => ({
          label: visualization.label,
          detail: visualization.detail,
          run: () => onAdd(visualization.id),
        })),
      },
    ]
  })
}

export function toMenuItem(action: ControlAction): MenuItem {
  if (action.children && action.children.length > 0) {
    return { label: action.label, children: action.children.map(toMenuItem) }
  }
  return { label: action.label, detail: action.detail, onAction: action.run }
}

// Mobile-only: when a plot is selected but the settings sheet isn't open
// yet, a floating Edit control opens it. Desktop never enters this state
// (selection opens the pane atomically there).
export function createEditPlotControl(
  onEdit: () => void
): ControlConfig {
  return {
    id: 'edit-plot',
    label: 'Edit plot settings',
    icon: controlIcons['edit-plot'],
    actions: [{ label: 'Edit plot settings', run: onEdit }],
    disabled: false,
  }
}
