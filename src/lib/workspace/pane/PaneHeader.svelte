<script lang="ts">
  import X from 'lucide-svelte/icons/x'
  import { useTooltipAction } from '$lib/tooltip'

  interface Props {
    title: string
    /** No handler, no button: the phone sheet is dismissed by the swipe. */
    onClose?: () => void
  }

  const { title, onClose }: Props = $props()

  const tooltipAction = useTooltipAction()
</script>

<div class="pane-header" class:centered={!onClose}>
  <!-- Title is rendered in the same typographic style as a PaneSection
       heading (10px uppercase, 600, darkgrey) so it reads as the root
       section of the settings stack rather than a heavier display title. -->
  <span class="title">{title}</span>
  {#if onClose}
    <button
      type="button"
      class="close"
      onclick={onClose}
      aria-label="Close settings"
      use:tooltipAction={{ content: 'Close (Esc)', position: 'bottom' }}
    >
      <X size={16} />
    </button>
  {/if}
</div>

<style>
  /* Same type and hairline as the site header and the control cards, so
     the pane reads as part of one app. */
  .pane-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 48px;
    padding: 0 8px 0 16px;
    background: transparent;
    border-bottom: 1px solid var(--c-border);
  }

  /* Nothing on either side to balance against: the title takes the middle,
     as a sheet's does. */
  .centered {
    padding-inline: 16px;
  }

  .centered .title {
    text-align: center;
  }

  .title {
    flex: 1;
    min-width: 0;
    color: var(--c-black);
    font-size: var(--text-xl);
    letter-spacing: -0.01em;
    font-weight: 600;
    line-height: var(--leading-tight);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--c-darkgrey);
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: var(--rounded-md);
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
    flex-shrink: 0;
    transition: background-color var(--transition-fast) ease;

    &:hover,
    &:focus-visible {
      background: var(--c-lightgrey);
      color: var(--c-black);
    }
  }
</style>
