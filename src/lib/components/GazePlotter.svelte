<script lang="ts">
  import Toaster from '$lib/components/Toaster/Toaster.svelte'
  import Modal from '$lib/components/Modal/Modal.svelte'
  import Panel from '$lib/components/Panel/Panel.svelte'
  import Workspace from '$lib/components/Workspace/Workspace.svelte'
</script>

<div id="GP-gazeplotter">
  <div class="panel-container">
    <Panel />
  </div>
  <Workspace />
  <Modal />
  <Toaster />
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
