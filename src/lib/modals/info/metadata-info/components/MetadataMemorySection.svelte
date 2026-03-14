<script lang="ts">
  import { formatFileSize } from '$lib/shared/utils/fileUtils'
  import MetadataSection from './MetadataSection.svelte'
  import {
    formatMemoryUtilization,
    type MetadataMemoryInfo,
  } from '../helpers'

  const { memoryInfo } = $props<{
    memoryInfo: MetadataMemoryInfo
  }>()
</script>

{#if memoryInfo.available}
  <MetadataSection title="RAM Usage">
    <div class="info-group">
      <div class="info-item">
        <span class="label">Current JS Heap Size (used):</span>
        <span class="value">{formatFileSize(memoryInfo.used)}</span>
      </div>
      <div class="info-item">
        <span class="label">Total JS Heap Size (allocated):</span>
        <span class="value">{formatFileSize(memoryInfo.total)}</span>
      </div>
      <div class="info-item">
        <span class="label">JS Heap Size Limit (max available):</span>
        <span class="value">{formatFileSize(memoryInfo.limit)}</span>
      </div>
      <div class="info-item">
        <span class="label">Memory utilization:</span>
        <span class="value">{formatMemoryUtilization(memoryInfo)}</span>
      </div>
    </div>
  </MetadataSection>
{/if}

<style>
  .info-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #f9f9f9;
    border-radius: 0.375rem;
    border: 1px solid #e5e5e5;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .label {
    font-weight: 500;
    color: #374151;
    min-width: fit-content;
  }

  .value {
    color: #1f2937;
    text-align: right;
    word-break: break-word;
  }
</style>
