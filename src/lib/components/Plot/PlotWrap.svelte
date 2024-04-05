<script lang="ts">
  export let title: string
</script>

<div class="plot">
  <div class="header">
    <h3>{title}</h3>
    <slot name="header" />
  </div>
  <div class="body">
    <slot name="body" />
  </div>
</div>

<style>
  .plot {
    border-radius: var(--rounded-lg) var(--rounded-lg) 0;
    box-shadow: 0 2px 10px rgb(0 0 0 / 15%);
    width: 100%;
    background: var(--c-white);
    box-sizing: border-box;
    overflow: hidden;
    height: 100%;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 30px;
    background: var(--c-lightgrey);
    flex-wrap: wrap;
    gap: 0 20px;
  }
  .body {
    padding: 30px;
  }
  h3 {
    margin: 0;
  }
</style>
