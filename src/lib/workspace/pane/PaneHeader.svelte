<script lang="ts">
  import X from 'lucide-svelte/icons/x'

  interface Props {
    title: string
    onClose: () => void
  }

  const { title, onClose }: Props = $props()
</script>

<div class="pane-header">
  <!-- Title is rendered in the same typographic style as a PaneSection
       heading (10px uppercase, 600, darkgrey) so it reads as the root
       section of the settings stack rather than a heavier display title. -->
  <span class="title">{title} settings</span>
  <button type="button" class="close" onclick={onClose} aria-label="Close pane">
    <X size={16} />
  </button>
</div>

<style>
  .pane-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 16px 8px;
    background: transparent;
  }

  .title {
    flex: 1;
    min-width: 0;
    color: var(--c-darkgrey);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    line-height: 1;
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
