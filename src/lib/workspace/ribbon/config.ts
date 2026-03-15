import Upload from 'lucide-svelte/icons/upload'
import Download from 'lucide-svelte/icons/download'
import FileText from 'lucide-svelte/icons/file-text'
import type { LucideIconComponent } from '$lib/shared/types'

export interface RibbonItemConfig {
  id: RibbonItemId
  label: string
  shortLabel: string
  icon: LucideIconComponent
  action: () => void
  disabled: boolean
}

interface CreateRibbonItemsOptions {
  isProcessing: boolean
  hasFatalError: boolean
  onUpload: () => void
  onExport: () => void
  onOpenMetadata: () => void
}

type RibbonItemId = 'upload' | 'export' | 'metadata'

const ribbonIcons = {
  upload: Upload,
  export: Download,
  metadata: FileText,
} satisfies Record<RibbonItemId, LucideIconComponent>

export function createRibbonItems(
  options: CreateRibbonItemsOptions
): RibbonItemConfig[] {
  return [
    {
      id: 'upload',
      label: 'Automatic file recognition (e.g., workspace, Tobii)',
      shortLabel: 'Import',
      icon: ribbonIcons.upload,
      action: options.onUpload,
      disabled: options.isProcessing,
    },
    {
      id: 'export',
      label: 'Export options (e.g., workspace, statistics)',
      shortLabel: 'Export',
      icon: ribbonIcons.export,
      action: options.onExport,
      disabled: options.isProcessing || options.hasFatalError,
    },
    {
      id: 'metadata',
      label: 'Source, parsing, and dataset context',
      shortLabel: 'Metadata',
      icon: ribbonIcons.metadata,
      action: options.onOpenMetadata,
      disabled: options.isProcessing,
    },
  ]
}
