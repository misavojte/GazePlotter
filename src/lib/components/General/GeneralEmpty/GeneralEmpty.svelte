<script lang="ts">
  import ListX from 'lucide-svelte/icons/list-x'
  interface Props {
    message: string;
  }

  let { message }: Props = $props();
</script>

<div class="empty">
  <ListX size={'1em'} />
  <span>{message}</span>
</div>

<style>
  .empty {
    padding: 1em;
    border: 1px solid var(--c-lightgrey);
    border-radius: var(--rounded);
    color: var(--c-darkgrey);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
  }
</style>
