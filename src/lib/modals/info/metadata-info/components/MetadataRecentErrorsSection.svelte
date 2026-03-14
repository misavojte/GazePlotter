<script lang="ts">
  import type { ErrorRecord } from '$lib/errors'
  import MetadataSection from './MetadataSection.svelte'
  import { formatMetadataDate } from '../helpers'

  const { errors } = $props<{
    errors: ErrorRecord[]
  }>()

  const newestFirstErrors = $derived([...errors].reverse())
</script>

{#if errors.length > 0}
  <MetadataSection title="Recent Errors">
    <div class="info-group">
      {#each newestFirstErrors as error (error.id)}
        <div class="recent-error">
          <div class="info-item">
            <span class="label">[{error.origin}] {error.severity}</span>
            <span class="value">{formatMetadataDate(error.createdAt)}</span>
          </div>
          <div class="info-item">
            <span class="label">User message:</span>
            <span class="value error-message">{error.userMessage}</span>
          </div>
          <div class="info-item">
            <span class="label">Debug message:</span>
            <span class="value">{error.debugMessage}</span>
          </div>
          {#if error.context}
            <div class="info-item stack-trace">
              <span class="label">Context:</span>
              <pre class="value error-stack"
                >{JSON.stringify(error.context, null, 2)}</pre
              >
            </div>
          {/if}
        </div>
      {/each}
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

  .error-message {
    color: #991b1b;
    font-weight: 500;
    text-align: right;
  }

  .stack-trace {
    flex-direction: column;
    align-items: flex-start;
  }

  .error-stack {
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: #fafafa;
    border: 1px solid #e5e5e5;
    border-radius: 0.25rem;
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    color: #4b5563;
    overflow-x: auto;
    max-width: 100%;
    white-space: pre-wrap;
    word-break: break-all;
    text-align: left;
  }
</style>
