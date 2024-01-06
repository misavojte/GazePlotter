<script lang="ts">
  export let legend: string
</script>

<fieldset>
  <legend>{legend}</legend>
  <slot />
</fieldset>

<style>
  fieldset {
    border: 1px solid #ccc;
    padding: 10px;
    margin-bottom: 20px;
  }
  legend {
    padding: 0 10px;
  }
</style>
