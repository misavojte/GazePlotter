<script lang="ts">
  import Toaster from './Toaster/Toaster.svelte'
  import Modal from './Modal/Modal.svelte'
  import Panel from './Panel/Panel.svelte'
  import Workspace from "$lib/components/Workspace/Workspace.svelte";
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

    :global(:root) {
        --c-brand: #cd1404;
        --c-brand-dark: #a20d03;
        --c-white: #fff;
        --c-darkwhite: #f3f3f5;
        --c-lightgrey: #ebebef;
        --c-darkgrey: #e4e4e9;
        --c-black: rgba(0, 0, 0, 0.75);
    }
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
