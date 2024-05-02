<script lang="ts">
  export let title: string
  export let id: number
</script>

<div class="header">
  <h3>{title}</h3>
  <slot name="header" />
</div>
<div class="body">
  <slot name="body" />
</div>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 30px;
    background: var(--c-lightgrey);
    flex-wrap: wrap;
    gap: 10px 20px;
  }
  .body {
    padding: 30px;
    flex-grow: 1;
    overflow: auto;
  }
  h3 {
    margin: 0;
  }
</style>
