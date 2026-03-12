<script lang="ts">
  import type { AllGridTypes } from '$lib/workspace/type/gridType'
  import type {
    WorkspaceCommand,
    WorkspaceCommandChain,
  } from '$lib/workspace/commands'
  import {
    resolveWorkspacePlotDefinition,
    type WorkspacePlotDispatcher,
  } from './plotResolver'

  interface Props {
    item: AllGridTypes
    onWorkspaceCommand?: (
      command: WorkspaceCommand | WorkspaceCommandChain
    ) => void
  }

  let { item, onWorkspaceCommand }: Props = $props()

  const plotDefinition = $derived(resolveWorkspacePlotDefinition(item))
  const PlotComponent = $derived(plotDefinition.component)
</script>

<PlotComponent {item} {onWorkspaceCommand} />
