<script lang="ts">
  import Image from 'lucide-svelte/icons/image'
  import MapPin from 'lucide-svelte/icons/map-pin'
  import User from 'lucide-svelte/icons/user'
  import Users from 'lucide-svelte/icons/users'
  import Download from 'lucide-svelte/icons/download'
  import { getGazePlotterSession } from '$lib/session'
  import {
    aoiModificationModal,
    downloadPlotModal,
    participantModificationModal,
    participantsGroupsModal,
    stimulusModificationModal,
  } from '$lib/modals/definitions'

  interface Props {
    item: {
      id: number
      type: string
      settings: Record<string, unknown>
    } | null
  }

  let { item }: Props = $props()
  const { modalState } = getGazePlotterSession()

  const stimulusId = $derived(
    item && typeof item.settings?.stimulusId === 'number'
      ? (item.settings.stimulusId as number)
      : 0
  )

  const source = $derived(item ? `${item.type}.${item.id}.pane` : 'pane')

  function openStimuli() {
    modalState.open(stimulusModificationModal, { source })
  }
  function openAois() {
    modalState.open(aoiModificationModal, {
      selectedStimulus: String(stimulusId),
      source,
    })
  }
  function openParticipants() {
    modalState.open(participantModificationModal, { source })
  }
  function openGroups() {
    modalState.open(participantsGroupsModal, { source })
  }
  function openExport() {
    if (!item) return
    modalState.open(downloadPlotModal, { item: item as any })
  }
</script>

<!-- Two-column grid of compact shortcuts below the PaneHeader. Each
     button is select-trigger sized (30px tall, 12px label) and uses
     the section-divider tone as its background so the row reads as a
     family of chips keyed to the pane's dividers. Export plot spans
     both columns to round out the odd count. -->
<div class="pane-quick-actions" role="toolbar" aria-label="Dataset shortcuts">
  <button type="button" class="quick-action" onclick={openStimuli}>
    <Image size={14} strokeWidth={1.6} aria-hidden="true" />
    <span>Stimuli</span>
  </button>
  <button type="button" class="quick-action" onclick={openAois}>
    <MapPin size={14} strokeWidth={1.6} aria-hidden="true" />
    <span>AOIs</span>
  </button>
  <button type="button" class="quick-action" onclick={openParticipants}>
    <User size={14} strokeWidth={1.6} aria-hidden="true" />
    <span>Participants</span>
  </button>
  <button type="button" class="quick-action" onclick={openGroups}>
    <Users size={14} strokeWidth={1.6} aria-hidden="true" />
    <span>Groups</span>
  </button>
  <button type="button" class="quick-action span-2" onclick={openExport}>
    <Download size={14} strokeWidth={1.6} aria-hidden="true" />
    <span>Export plot</span>
  </button>
</div>

<style>
  /* Sits inside the content column: horizontal padding matches
     PaneSection's body (16px). Two columns let the dataset shortcuts
     pair up neatly; the plot-level action (Export) stretches across
     both to mark it as a different category. */
  .pane-quick-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    width: 100%;
    padding: 10px 16px;
    box-sizing: border-box;
  }

  /* Button uses the divider tone (#e2e8f0) as its base background so
     the whole quick-actions row reads as a family of chips keyed to
     the pane's own dividers. Border, radius, and dimensions still
     match a Select trigger so they pair visually with the form
     fields below. */
  .quick-action {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 30px;
    padding: 0 12px;
    background: #e2e8f0;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    cursor: pointer;
    color: var(--c-darkgrey);
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    text-align: left;
    box-sizing: border-box;
    min-width: 0;
    transition:
      background 0.12s ease,
      color 0.12s ease,
      border-color 0.12s ease;
  }
  .quick-action span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .quick-action.span-2 {
    grid-column: span 2;
  }
  .quick-action:hover {
    background: #cfd8e3;
    color: var(--c-brand);
  }
  .quick-action:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--c-info) 45%, transparent);
    outline-offset: 1px;
  }
</style>
