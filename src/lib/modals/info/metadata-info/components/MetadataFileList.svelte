<script lang="ts">
  import { formatFileSize } from '$lib/shared/format'

  const { fileNames, fileSizes } = $props<{
    fileNames: string[]
    fileSizes: number[]
  }>()
</script>

<div class="file-list">
  {#each fileNames as fileName, index}
    <div class="file-item">
      <span class="file-name">{fileName}</span>
      {#if fileSizes[index] !== undefined}
        <span class="file-size">({formatFileSize(fileSizes[index])})</span>
      {/if}
    </div>
  {/each}
</div>

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
