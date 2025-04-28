<script lang="ts">
  interface Props {
    text: string
  }

  let { text }: Props = $props()
</script>

<div class="section-header">{text}</div>

<style>
  .section-header {
    font-weight: 600;
    margin: 0 0 0.5rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid #eaeaea;
  }
</style>
