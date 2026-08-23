<script lang="ts">
  import { formatFileSize } from '$lib/shared/format'
  import { Card } from '$lib/shared/components'
  import MetadataSection from './MetadataSection.svelte'
  import InfoRow from './InfoRow.svelte'
  import { formatMemoryUtilization, type MetadataMemoryInfo } from '../helpers'

  const { memoryInfo } = $props<{
    memoryInfo: MetadataMemoryInfo
  }>()
</script>

{#if memoryInfo.available}
  <MetadataSection title="RAM Usage">
    <Card padding="sm" gap="0.5rem">
      <InfoRow label="Current JS Heap Size (used):" value={formatFileSize(memoryInfo.used)} />
      <InfoRow label="Total JS Heap Size (allocated):" value={formatFileSize(memoryInfo.total)} />
      <InfoRow label="JS Heap Size Limit (max available):" value={formatFileSize(memoryInfo.limit)} />
      <InfoRow label="Memory utilization:" value={formatMemoryUtilization(memoryInfo)} />
    </Card>
  </MetadataSection>
{/if}
