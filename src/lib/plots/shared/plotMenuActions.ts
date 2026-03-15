import type { ModalDefinition, ModalProps } from '$lib/modals/defineModal'
import {
  aoiModificationModal,
  aoiVisibilityModal,
  participantModificationModal,
  participantsGroupsModal,
  stimulusModificationModal,
} from '$lib/modals/definitions'
import type { LucideIconComponent } from '$lib/shared/types'
import Settings from 'lucide-svelte/icons/settings-2'
import Users from 'lucide-svelte/icons/users'
import View from 'lucide-svelte/icons/view'
import type { Component } from 'svelte'
import type { ErrorService } from '$lib/errors'

export interface PlotMenuItem {
  icon?: LucideIconComponent
  label?: string
  onAction?: () => void
  isDivider?: boolean
}

type OpenModal = <TDefinition extends ModalDefinition<Component<any>, any>>(
  definition: TDefinition,
  props: ModalProps<TDefinition>
) => void

interface PlotModalActionParams<
  TDefinition extends ModalDefinition<Component<any>, any>,
> {
  openModal: OpenModal
  definition: TDefinition
  props: ModalProps<TDefinition>
  icon: LucideIconComponent
  label?: string
  errorContext?: PlotMenuErrorContext
  onError?: (error: unknown) => void
}

interface PlotSharedActionParams {
  openModal: OpenModal
  source: string
  errorContext?: PlotMenuErrorContext
}

interface PlotAoiActionParams extends PlotSharedActionParams {
  stimulusId: number
}

interface PlotMenuItemContext {
  id: string | number
  type: string
}

export interface PlotMenuErrorContext {
  errorService: Pick<ErrorService, 'report'>
  getItemContext: () => PlotMenuItemContext
}

export function createPlotMenuErrorContext<
  TItem extends PlotMenuItemContext,
>(
  errorService: Pick<ErrorService, 'report'>,
  getItemContext: () => TItem
): PlotMenuErrorContext {
  return {
    errorService,
    getItemContext,
  }
}

export function createPlotModalAction<
  TDefinition extends ModalDefinition<Component<any>, any>,
>({
  openModal,
  definition,
  props,
  icon,
  label,
  errorContext,
  onError,
}: PlotModalActionParams<TDefinition>): PlotMenuItem {
  const actionLabel = label ?? definition.title
  return {
    label: actionLabel,
    icon,
    onAction: () => {
      try {
        openModal(definition, props)
      } catch (error) {
        if (onError) {
          onError(error)
          return
        }

        if (!errorContext) return
        const itemContext = errorContext.getItemContext()

        errorContext.errorService.report({
          origin: 'plot',
          severity: 'recoverable',
          userMessage: `Could not open "${actionLabel}" dialog.`,
          cause: error,
          context: {
            itemId: itemContext.id,
            plotType: itemContext.type,
            actionLabel,
          },
        })
      }
    },
  }
}

export function createAoiCustomizationMenuAction({
  openModal,
  source,
  stimulusId,
  errorContext,
}: PlotAoiActionParams): PlotMenuItem {
  return createPlotModalAction({
    openModal,
    definition: aoiModificationModal,
    props: {
      selectedStimulus: stimulusId.toString(),
      source,
    },
    icon: Settings,
    errorContext,
  })
}

export function createStimulusCustomizationMenuAction({
  openModal,
  source,
  errorContext,
}: PlotSharedActionParams): PlotMenuItem {
  return createPlotModalAction({
    openModal,
    definition: stimulusModificationModal,
    props: {
      source,
    },
    icon: Settings,
    errorContext,
  })
}

export function createParticipantsGroupsMenuAction({
  openModal,
  source,
  errorContext,
}: PlotSharedActionParams): PlotMenuItem {
  return createPlotModalAction({
    openModal,
    definition: participantsGroupsModal,
    props: {
      source,
    },
    icon: Users,
    errorContext,
  })
}

export function createParticipantCustomizationMenuAction({
  openModal,
  source,
  errorContext,
}: PlotSharedActionParams): PlotMenuItem {
  return createPlotModalAction({
    openModal,
    definition: participantModificationModal,
    props: {
      source,
    },
    icon: Users,
    errorContext,
  })
}

export function createAoiVisibilityMenuAction({
  openModal,
  source,
  errorContext,
}: PlotSharedActionParams): PlotMenuItem {
  return createPlotModalAction({
    openModal,
    definition: aoiVisibilityModal,
    props: {
      source,
    },
    icon: View,
    errorContext,
  })
}

export function createPlotMenuDivider(): PlotMenuItem {
  return { isDivider: true }
}

