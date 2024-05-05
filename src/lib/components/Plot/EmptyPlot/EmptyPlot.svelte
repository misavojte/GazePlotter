<script lang="ts">
  import GeneralButtonMajor from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import PlotWrap from '../PlotWrap.svelte'
  import PanelButtonUpload from '$lib/components/Panel/PanelButton/PanelButtonUpload.svelte'
  import PanelButtonDemo from '$lib/components/Panel/PanelButton/PanelButtonDemo.svelte'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore.ts'

  const reloadViews = () => {
    processingFileStateStore.set('done')
  }
</script>

<PlotWrap title="Workspace empty">
  <div slot="body">
    <p>
      No data views in the workspace. However, data is still available in the
      memory. You can upload new data, load sample data or reload current data.
    </p>
    <div class="box">
      <GeneralButtonMajor on:click={reloadViews}>
        Reload views
      </GeneralButtonMajor>
      <PanelButtonUpload />
      <PanelButtonDemo />
    </div>
  </div>
</PlotWrap>

<style>
  p {
    margin: 0 0 30px;
  }
</style>
