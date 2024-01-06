<script lang="ts">
  export let legend: string | null
  export let id: string
</script>

<div class="input">
  <label for={id}>{legend}</label>
  <slot itemtype="input" />
</div>

<style>
  .input {
    display: flex;
    flex-direction: column;
    margin-bottom: 15px;
    gap: 5px;
  }
</style>
