<script lang="ts">
  export let label: string | null
  export let id: string
</script>

<div class="input">
  <label for={id}>{label}</label>
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
