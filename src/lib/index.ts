export { default as GazePlotter } from '$lib/GazePlotter.svelte'
export { createGazePlotterSession, getGazePlotterSession } from '$lib/session'
export type {
  GazePlotterSession,
  GazePlotterOptions,
  SaveFile,
  OpenFiles,
  GazePlotterColors,
} from '$lib/session'
export { fromUrl } from '$lib/session/loaders'
export type { DataLoader } from '$lib/data/ingest/types'
// Web defaults of the function options, exported so hosts can wrap rather
// than replace them (e.g. try native, fall back to the browser picker).
export { triggerDownload } from '$lib/session/download'
export { openFilesViaBrowser, INGEST_FILE_ACCEPT } from '$lib/session/openFiles'
export * from '$lib/workspace/grid'
export * from '$lib/workspace/commands'
export { createWorkspaceActions, type WorkspaceActions } from '$lib/workspace/actions.svelte'
export { withShortcut } from '$lib/workspace/keys'

// The design system a host page builds its own chrome with, as
// gazeplotter.com's app pages do: tokens, the two form controls, the tooltip
// action, the toaster, and the modal contract.
export { default as DesignTokens } from './DesignTokens.svelte'
export { Button, InputCheck } from '$lib/shared/components'
export type { LucideIconComponent } from '$lib/shared/icon'
export { generateUniqueId } from '$lib/shared/uniqueId'
export { hostTooltipAction } from './tooltip'
export type { TooltipActionOptions } from '$lib/tooltip/tooltip.action'
export { ToastState } from '$lib/toaster/toastState.svelte'
export { defineModal } from '$lib/modals/defineModal'
