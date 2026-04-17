<script lang="ts">
  import X from 'lucide-svelte/icons/x'

  interface Props {
    title: string
    subtitle?: string
    onClose: () => void
  }

  const { title, subtitle, onClose }: Props = $props()
</script>

<div class="pane-header">
  <div class="titles">
    <div class="title">{title}</div>
    {#if subtitle}
      <div class="subtitle">{subtitle}</div>
    {/if}
  </div>
  <button type="button" class="close" onclick={onClose} aria-label="Close pane">
    <X size={16} />
  </button>
</div>

<style>
  .pane-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--c-border);
    background: transparent;
  }

  .titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .title {
    font-size: 14px;
    font-weight: 600;
    color: var(--c-text);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .subtitle {
    font-size: 8px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.0333em;
    color: var(--c-darkgrey);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--c-darkgrey);
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
    flex-shrink: 0;
  }
  .close:hover {
    background: var(--c-lightgrey, #e5e7eb);
    color: var(--c-text);
  }
</style>
