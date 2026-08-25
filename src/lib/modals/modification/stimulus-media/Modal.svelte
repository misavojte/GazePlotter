<script lang="ts">
  import { Section, ModalButtons } from '$lib/modals'
  import { InputNumber, Button } from '$lib/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { formatFileSize } from '$lib/shared/format'
  import { stimulusMediaStore } from '$lib/data/media/mediaStore.svelte'
  import {
    buildStimulusMediaFromFile,
    MEDIA_FILE_ACCEPT,
    mediaRegionOf,
  } from '$lib/data/media/mediaUpload'
  import type { StimulusMedia } from '$lib/data/types'

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
      // New pixel space: re-seed the mapping to the file's natural size.
      x = 0
      y = 0
      width = picked.naturalWidth
      height = picked.naturalHeight
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

  function resetToImageSize() {
    if (!media) return
    x = 0
    y = 0
    width = media.naturalWidth
    height = media.naturalHeight
  }

  function onApply() {
    if (!media || !blob) return
    if (
      x === undefined ||
      y === undefined ||
      !(width !== undefined && width > 0) ||
      !(height !== undefined && height > 0)
    ) {
      toastState.addWarning('Width and height must be positive numbers.')
      return
    }
    const isNatural =
      x === 0 && y === 0 && width === media.naturalWidth && height === media.naturalHeight
    const { region: _prev, ...rest } = media
    workspace.apply({
      type: 'updateStimulusMedia',
      stimulusId,
      media: isNatural ? rest : { ...rest, region: { x, y, width, height } },
      blob,
      source,
    })
    modalState.close()
  }

  function onRemove() {
    workspace.apply({
      type: 'updateStimulusMedia',
      stimulusId,
      media: null,
      blob: null,
      source,
    })
    modalState.close()
  }
</script>

<input
  bind:this={fileInput}
  type="file"
  accept={MEDIA_FILE_ACCEPT}
  class="file-input"
  onchange={onFilePicked}
/>

{#if media}
  <Section title={stimulusName}>
    <div class="stack">
      <div class="preview">
        {#if previewUrl}
          {#if media.kind === 'image'}
            <img src={previewUrl} alt={media.fileName} />
          {:else}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video src={previewUrl} controls muted></video>
          {/if}
        {/if}
      </div>
      <div class="meta">
        <span class="file-name" title={media.fileName}>{media.fileName}</span>
        <span>
          {media.kind} · {media.naturalWidth}×{media.naturalHeight}{#if blob}
            · {formatFileSize(blob.size)}{/if}
        </span>
        <div class="replace">
          <Button size="sm" onclick={() => fileInput?.click()}>Replace…</Button>
        </div>
      </div>
    </div>
  </Section>

  <Section title="Position in gaze coordinates">
    <div class="stack">
      <p class="hint">
        Where the media sits in your recording's coordinate system. By default
        gaze coordinates are assumed to equal image pixels. Change these when
        the stimulus was offset on screen or recorded at a different scale.
      </p>
      <div class="coord-group">
        <span class="coord-label">Top-left corner of the media</span>
        <div class="coord-fields">
          <InputNumber label="Left (gaze X)" min={COORD_MIN} bind:value={x} />
          <InputNumber label="Top (gaze Y)" min={COORD_MIN} bind:value={y} />
        </div>
      </div>
      <div class="coord-group">
        <span class="coord-label">Size of the media, in gaze units</span>
        <div class="coord-fields">
          <InputNumber label="Width" min={1} bind:value={width} />
          <InputNumber label="Height" min={1} bind:value={height} />
        </div>
      </div>
      <div>
        <Button size="sm" onclick={resetToImageSize}>Reset to image size</Button>
      </div>
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
  .preview {
    display: flex;
    justify-content: center;
    background: var(--c-darkwhite);
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    overflow: hidden;
  }

  .preview img,
  .preview video {
    max-width: 100%;
    max-height: 320px;
    object-fit: contain;
  }

  .meta {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    font-size: 12px;
    color: var(--c-darkgrey, #555);
  }

  .replace {
    margin-left: auto;
  }

  .file-input {
    display: none;
  }

  .file-name {
    max-width: 18rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: var(--c-text);
  }

  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--c-darkgrey, #555);
  }

  /* Section children carry no margins of their own; the stack is what puts
     air between the preview, hints, field groups, and buttons. */
  .stack {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .coord-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .coord-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--c-darkgrey, #555);
  }

  .coord-fields {
    display: flex;
    gap: 0.75rem;
  }

</style>
