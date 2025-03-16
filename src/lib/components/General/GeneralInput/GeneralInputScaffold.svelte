<script lang="ts">
  interface Props {
    label: string | null;
    id: string;
    children?: import('svelte').Snippet<[any]>;
  }

  let { label, id, children }: Props = $props();
</script>

<div class="input">
  <label for={id}>{label}</label>
  {@render children?.({ itemtype: "input", })}
</div>

<style>
  .input {
    display: flex;
    flex-direction: column;
    margin-bottom: 15px;
    gap: 5px;
  }
</style>
