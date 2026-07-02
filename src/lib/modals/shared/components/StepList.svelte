<script lang="ts">
  import type { Snippet } from 'svelte'
  import { setStepListContext } from './stepContext'

  interface Props {
    children: Snippet
  }

  let { children }: Props = $props()

  let openStep = $state(1)

  setStepListContext({
    isOpen: n => openStep === n,
    toggle: n => {
      openStep = openStep === n ? 0 : n
    },
  })
</script>

<ol class="steps">
  {@render children()}
</ol>

<style>
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
</style>
