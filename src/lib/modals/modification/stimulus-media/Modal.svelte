<script lang="ts">
  import { Section, ModalButtons } from '$lib/modals'
  import { InputNumber, Button, Select } from '$lib/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { formatFileSize } from '$lib/shared/format'
  import { stimulusMediaStore } from '$lib/data/media/mediaStore.svelte'
  import {
    buildStimulusMediaFromFile,
    MEDIA_FILE_ACCEPT,
    mediaRegionOf,
  } from '$lib/data/media/mediaUpload'
  import {
    collectFixationPoints,
    coverBounds,
    pointsBounds,
    snapRect,
    snapStepForSize,
    type Rect,
  } from '$lib/data/media/mediaAlignment'
  import { getAllParticipants } from '$lib/data/engine'
  import type { StimulusMedia } from '$lib/data/types'
  import AlignmentCanvas from './AlignmentCanvas.svelte'
  import { isTextEntryTarget } from '$lib/workspace/keys'

  export interface Props {
    stimulusId: number
    /** Displayed stimulus name, for the header readout. */
    stimulusName: string
    source: string
  }

  let { stimulusId, stimulusName, source }: Props = $props()
  const { engine, workspace, modalState, toastState } = getGazePlotterSession()

  const saved = $derived(engine.metadata?.stimuliMedia?.[stimulusId] ?? null)
  const savedBlob = $derived.by(() => {
    void stimulusMediaStore.version
    return stimulusMediaStore.getBlob(stimulusId)
  })

  // A picked-but-not-applied file from the manual picker: it wins over the
  // saved media until Apply commits it (Cancel just discards it).
  let draft = $state<{ media: StimulusMedia; blob: Blob } | null>(null)
  const media = $derived(draft?.media ?? saved)
  const blob = $derived(draft?.blob ?? savedBlob)

  let fileInput: HTMLInputElement | null = null

  async function onFilePicked(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const picked = await buildStimulusMediaFromFile(file)
      draft = { media: picked, blob: file }
      // New pixel space: re-seed the mapping to the file's natural size. The
      // old undo steps belong to the old file, so they go too.
      history = []
      setRegion({ x: 0, y: 0, width: picked.naturalWidth, height: picked.naturalHeight })
      alignCanvas?.fit()
    } catch {
      toastState.addWarning(
        `Can't attach ${file.name}: not a readable image or video.`
      )
    }
  }

  // Component-local preview URL (separate from the canvas element cache):
  // created per blob, revoked on change/teardown.
  let previewUrl = $state<string | null>(null)
  $effect(() => {
    const url = blob ? URL.createObjectURL(blob) : null
    previewUrl = url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  })

  // Coordinate draft, seeded from the current mapping once per open.
  // svelte-ignore state_referenced_locally
  const initial = saved ? mediaRegionOf(saved) : { x: 0, y: 0, width: 0, height: 0 }
  let x = $state<number | undefined>(initial.x)
  let y = $state<number | undefined>(initial.y)
  let width = $state<number | undefined>(initial.width)
  let height = $state<number | undefined>(initial.height)

  const COORD_MIN = -1_000_000

  /** The saved position when the modal opened, drawn on the canvas for reference. */
  // svelte-ignore state_referenced_locally
  const original: Rect | null = saved ? { ...initial } : null

  /** The typed values as a rect, or null while one is missing or not positive. */
  const region = $derived<Rect | null>(
    x !== undefined &&
      y !== undefined &&
      width !== undefined &&
      width > 0 &&
      height !== undefined &&
      height > 0
      ? { x, y, width, height }
      : null
  )

  function setRegion(r: Rect) {
    x = r.x
    y = r.y
    width = r.width
    height = r.height
  }

  // Fixations to align against: every participant's, or one participant's.
  const ALL_PARTICIPANTS = 'all'
  let fixationsFrom = $state(ALL_PARTICIPANTS)
  const participantOptions = $derived([
    { label: 'All participants', value: ALL_PARTICIPANTS },
    ...getAllParticipants(engine).map(p => ({
      label: p.displayedName,
      value: String(p.id),
    })),
  ])
  const points = $derived.by(() => {
    void engine.metadata
    const reader = engine.getReader()
    if (!reader) return new Float64Array(0)
    const ids =
      fixationsFrom === ALL_PARTICIPANTS
        ? getAllParticipants(engine).map(p => p.id)
        : [Number(fixationsFrom)]
    return collectFixationPoints(reader, stimulusId, ids)
  })
  const hasPoints = $derived(points.length > 0)

  // Undo within the modal: one step per drag, per button, and per burst of
  // arrow-key nudges. Cancel still discards everything.
  const NUDGE_BURST_MS = 800
  let history = $state.raw<Rect[]>([])
  let lastNudgeAt = 0

  function snapshot(kind: 'drag' | 'nudge' | 'button') {
    if (!region) return
    const now = performance.now()
    const sameBurst = kind === 'nudge' && now - lastNudgeAt < NUDGE_BURST_MS
    lastNudgeAt = kind === 'nudge' ? now : 0
    if (sameBurst) return
    history = [...history.slice(-49), region]
  }

  function undo() {
    const previous = history.at(-1)
    if (!previous) return
    history = history.slice(0, -1)
    setRegion(previous)
  }

  // The workspace's own undo is off while a modal is open, so Ctrl+Z here
  // only ever means "undo the last alignment edit".
  function onWindowKeydown(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.code !== 'KeyZ') return
    if (isTextEntryTarget(e)) return
    e.preventDefault()
    undo()
  }

  let alignCanvas = $state<ReturnType<typeof AlignmentCanvas> | null>(null)

  function resetToMediaSize() {
    if (!media) return
    snapshot('button')
    setRegion({ x: 0, y: 0, width: media.naturalWidth, height: media.naturalHeight })
    alignCanvas?.fit()
  }

  function fitToFixations() {
    const bounds = pointsBounds(points)
    if (!media || !bounds) return
    snapshot('button')
    const r = coverBounds(bounds, media.naturalWidth / media.naturalHeight)
    setRegion(snapRect(r, snapStepForSize(Math.max(r.width, r.height))))
    alignCanvas?.fit()
  }

  function onApply() {
    if (!media || !blob) return
    if (!region) {
      toastState.addWarning('Width and height must be positive numbers.')
      return
    }
    const before = saved ? mediaRegionOf(saved) : null
    const unchanged =
      !draft &&
      before !== null &&
      before.x === region.x &&
      before.y === region.y &&
      before.width === region.width &&
      before.height === region.height
    // Nothing changed: close without an empty undo step.
    if (unchanged) {
      modalState.close()
      return
    }
    const { x, y, width, height } = region
    const isNatural =
      x === 0 && y === 0 && width === media.naturalWidth && height === media.naturalHeight
    const { region: _prev, ...rest } = media
    workspace.apply({
      type: 'updateStimulusMedia',
      updates: [
        {
          stimulusId,
          media: isNatural ? rest : { ...rest, region: { x, y, width, height } },
          blob,
        },
      ],
      source,
    })
    modalState.close()
  }

  function onRemove() {
    workspace.apply({
      type: 'updateStimulusMedia',
      updates: [{ stimulusId, media: null, blob: null }],
      source,
    })
    modalState.close()
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<input
  bind:this={fileInput}
  type="file"
  accept={MEDIA_FILE_ACCEPT}
  class="file-input"
  onchange={onFilePicked}
/>

{#if media}
  <Section>
    <div class="meta">
      <span class="stimulus-name" title={stimulusName}>{stimulusName}</span>
      <span class="file-name" title={media.fileName}>{media.fileName}</span>
      <span>
        {media.kind} · {media.naturalWidth}×{media.naturalHeight}{#if blob}
          · {formatFileSize(blob.size)}{/if}
      </span>
      <div class="replace">
        <Button size="sm" onclick={() => fileInput?.click()}>Replace…</Button>
      </div>
    </div>
  </Section>

  <Section title="Alignment">
    <div class="stack">
      {#if hasPoints}
        <p class="hint" id="media-align-hint">
          Drag the media until the fixations sit on its content. Drag a corner
          to resize, with Shift to change proportions. Typed values are stored
          exactly as entered.
        </p>
        <div class="controls">
          <div class="fixations-from">
            <Select
              label="Fixations from"
              options={participantOptions}
              value={fixationsFrom}
              onchange={e => (fixationsFrom = e.detail as string)}
            />
          </div>
          <Button size="sm" isDisabled={history.length === 0} onclick={undo}>Undo</Button>
          <Button size="sm" onclick={fitToFixations}>Fit to fixations</Button>
          <Button size="sm" onclick={resetToMediaSize}>Reset to media size</Button>
        </div>
      {:else}
        <p class="hint" id="media-align-hint">
          This stimulus has no fixations with coordinates, so there is nothing
          to align the media against. Enter its position below if you know it.
        </p>
      {/if}
      <div class="canvas-block">
        <AlignmentCanvas
          bind:this={alignCanvas}
          kind={media.kind}
          src={previewUrl}
          {points}
          {region}
          {original}
          onchange={setRegion}
          onbegin={snapshot}
          describedBy="media-align-hint"
        />
      </div>
      <div class="coord-row">
        <div class="coord-group">
          <span class="coord-label">Top-left corner, in gaze units</span>
          <div class="coord-fields">
            <InputNumber label="Left (gaze X)" min={COORD_MIN} step="any" bind:value={x} />
            <InputNumber label="Top (gaze Y)" min={COORD_MIN} step="any" bind:value={y} />
          </div>
        </div>
        <div class="coord-group">
          <span class="coord-label">Size, in gaze units</span>
          <div class="coord-fields">
            <InputNumber label="Width" min={0} step="any" bind:value={width} />
            <InputNumber label="Height" min={0} step="any" bind:value={height} />
          </div>
        </div>
      </div>
      {#if !hasPoints}
        <div>
          <Button size="sm" onclick={resetToMediaSize}>Reset to media size</Button>
        </div>
      {/if}
    </div>
  </Section>

  <ModalButtons
    buttons={[
      { label: 'Apply', onclick: onApply, variant: 'primary' },
      ...(saved ? [{ label: 'Remove media', onclick: onRemove }] : []),
      { label: 'Cancel', onclick: () => modalState.close() },
    ]}
  />
{:else}
  <Section title={stimulusName}>
    <div class="stack">
      <p class="hint">
        No reference media on this stimulus yet. Attach an image or video and
        plots draw it behind the gaze data (the scanpath background).
      </p>
      <div>
        <Button variant="primary" onclick={() => fileInput?.click()}>
          Choose image or video…
        </Button>
      </div>
      <p class="hint">
        Media files added through Upload data attach automatically when named
        after the stimulus.
      </p>
    </div>
  </Section>
  <ModalButtons
    buttons={[{ label: 'Close', onclick: () => modalState.close() }]}
  />
{/if}

<style>
  .controls {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .fixations-from {
    flex: 1 1 192px;
    min-width: 0;
  }

  .meta {
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: var(--text-sm);
    font-family: var(--font-small);
    color: var(--c-darkgrey);
  }

  .replace {
    margin-left: auto;
  }

  .file-input {
    display: none;
  }

  .stimulus-name {
    max-width: 224px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--c-black);
  }

  .file-name {
    max-width: 288px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-md);
    color: var(--c-black);
  }

  .hint {
    margin: 0;
    font-size: var(--text-md);
    color: var(--c-darkgrey);
    text-wrap: pretty;
  }

  /* Section children carry no margins of their own; the stack is what puts
     air between the preview, hints, field groups, and buttons. */
  .stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .coord-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .coord-label {
    font-size: var(--text-sm);
    font-family: var(--font-small);
    font-weight: 600;
    color: var(--c-darkgrey);
  }

  .coord-fields {
    display: flex;
    gap: 12px;
  }

  /* The canvas sets the modal's width: wide enough for precise work, never
     wider than the viewport allows. */
  .canvas-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: min(860px, calc(100vw - 160px));
    max-width: 100%;
  }

  .coord-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 24px;
  }

</style>
