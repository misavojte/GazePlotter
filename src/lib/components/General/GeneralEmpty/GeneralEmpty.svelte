<script lang="ts">
  import ListX from 'lucide-svelte/icons/list-x'
  export let message: string
</script>

<div class="empty">
  <ListX size={'1em'} />
  <span>{message}</span>
</div>

<style>
  .empty {
    padding: 1em;
    border: 1px solid #ebebef;
    border-radius: 3px;
    color: gray;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
  }
</style>
