<script lang="ts">
  import { formatFileSize } from '$lib/shared/utils/fileUtils'

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
    margin-left: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .file-name {
    color: #374151;
    font-weight: 500;
  }

  .file-size {
    color: #6b7280;
    font-size: 0.85rem;
  }
</style>
