<script lang="ts">
  interface Props {
    title: string
    description?: string
    onclick: () => void
  }

  let { title, description, onclick }: Props = $props()
</script>

<button type="button" class="pick-card" {onclick}>
  <span class="pick-card-title">{title}</span>
  {#if description}<p class="pick-card-desc">{description}</p>{/if}
</button>

<style>
  .pick-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    padding: 12px;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    background: var(--c-darkwhite);
    cursor: pointer;
    transition: all var(--transition-normal) ease;
    text-align: left;
    outline: none;
  }
  .pick-card:hover {
    border-color: var(--c-brand);
    background: var(--c-white);
    box-shadow: var(--shadow);
  }
  .pick-card:focus-visible {
    border-color: var(--c-brand);
  }

  .pick-card-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--c-text);
  }

  .pick-card-desc {
    font-size: 11px;
    color: var(--c-darkgrey);
    margin: 0;
    line-height: 1.4;
  }
</style>
