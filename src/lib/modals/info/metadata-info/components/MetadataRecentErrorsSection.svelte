<script lang="ts">
  import type { ErrorRecord } from '$lib/errors'
  import { Card } from '$lib/shared/components'
  import MetadataSection from './MetadataSection.svelte'
  import InfoRow from './InfoRow.svelte'
  import { formatMetadataDate } from '../helpers'

  const { errors } = $props<{
    errors: ErrorRecord[]
  }>()

  const newestFirstErrors = $derived([...errors].reverse())
</script>

{#if errors.length > 0}
  <MetadataSection title="Recent Errors">
    <Card padding="sm" gap="0.75rem">
      {#each newestFirstErrors as error (error.id)}
        <div class="recent-error">
          <InfoRow label={`[${error.origin}] ${error.severity}`} value={formatMetadataDate(error.createdAt)} />
          <InfoRow label="User message:" value={error.userMessage} variant="error" />
          <InfoRow label="Debug message:" value={error.debugMessage} />
          {#if error.context}
            <InfoRow label="Context:" value={JSON.stringify(error.context, null, 2)} variant="stack" />
          {/if}
        </div>
      {/each}
    </Card>
  </MetadataSection>
{/if}

<style>
  .recent-error {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .recent-error:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }
</style>
