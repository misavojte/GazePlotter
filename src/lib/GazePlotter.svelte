<script lang="ts">
  import Toaster from '$lib/toaster/components/Toaster.svelte'
  import { Modal } from '$lib/modals'
  import Panel from '$lib/workspace/panel/components/Panel.svelte'
  import Workspace from '$lib/workspace/components/Workspace.svelte'
  import Tooltip from '$lib/tooltip/components/Tooltip.svelte'
</script>

<div id="GP-gazeplotter">
  <div class="panel-container">
    <Panel />
  </div>
  <Workspace />
  <Modal />
  <Toaster />
  <Tooltip />
</div>

<style>
  #GP-gazeplotter {
    font-family: inherit;
    font-size: 16px;
    line-height: 1.5;
    color: var(--c-black);
  }
  .panel-container {
    max-width: 1220px;
    margin-inline: auto;
    margin-block: 40px;
  }
</style>
