<script lang="ts">
  import { Section, ModalButtons } from '$lib/modals'
  import { InputNumber, Button } from '$lib/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { formatFileSize } from '$lib/shared/format'
  import { stimulusMediaStore } from '$lib/data/media/mediaStore.svelte'
  import { mediaRegionOf } from '$lib/data/media/mediaUpload'

  export interface Props {
    stimulusId: number
    /** Displayed stimulus name, for the header readout. */
    stimulusName: string
    source: string
  }

  let { stimulusId, stimulusName, source }: Props = $props()
  const { engine, workspace, modalState, toastState } = getGazePlotterSession()

  const media = $derived(engine.metadata?.stimuliMedia?.[stimulusId] ?? null)
  const blob = $derived.by(() => {
    void stimulusMediaStore.version
    return stimulusMediaStore.getBlob(stimulusId)
  })

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
  const initial = media ? mediaRegionOf(media) : { x: 0, y: 0, width: 0, height: 0 }
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

{#if media}
  <Section title={stimulusName}>
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
    </div>
  </Section>

  <Section title="Position in gaze coordinates">
    <p class="hint">
      The rectangle of the gaze coordinate space this media covers. A fixation
      at gaze (x, y) lands on the image when the image spans that point —
      adjust when recording coordinates don't match the image pixels.
    </p>
    <div class="coords">
      <InputNumber label="X" min={COORD_MIN} bind:value={x} />
      <InputNumber label="Y" min={COORD_MIN} bind:value={y} />
      <InputNumber label="Width" min={1} bind:value={width} />
      <InputNumber label="Height" min={1} bind:value={height} />
      <div class="reset">
        <Button size="sm" onclick={resetToImageSize}>Reset to image size</Button>
      </div>
    </div>
  </Section>

  <ModalButtons
    buttons={[
      { label: 'Apply', onclick: onApply, variant: 'primary' },
      { label: 'Remove media', onclick: onRemove },
      { label: 'Cancel', onclick: () => modalState.close() },
    ]}
  />
{:else}
  <Section>
    <p class="hint">
      No reference media on this stimulus. Add an image or video through
      Upload data — files named after the stimulus attach automatically.
    </p>
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
    align-items: baseline;
    font-size: 12px;
    color: var(--c-darkgrey, #555);
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

  .coords {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .reset {
    padding-bottom: 2px;
  }
</style>
