<script lang="ts">
  import { formatFileSize } from '$lib/shared/format'
  import { Card } from '$lib/shared/components'
  import InfoRow from './InfoRow.svelte'

  interface Props {
    label: string
    files: { fileNames: string[]; fileSizes: number[] }
  }

  const { label, files }: Props = $props()
</script>

<Card padding="sm" gap="8px">
  <InfoRow {label} value={files.fileNames.length} />
  <div class="file-list">
    {#each files.fileNames as fileName, index}
      <div class="file-item">
        <span class="file-name">{fileName}</span>
        {#if files.fileSizes[index] !== undefined}
          <span class="file-size">({formatFileSize(files.fileSizes[index])})</span>
        {/if}
      </div>
    {/each}
  </div>
</Card>

<style>
  .file-list {
    margin-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--text-lg);
  }

  .file-name {
    color: var(--c-black);
    font-weight: 500;
  }

  .file-size {
    color: var(--c-darkgrey);
    font-size: var(--text-lg);
  }
</style>
