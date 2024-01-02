<script>
  import GeneralButtonMajor from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import PlotWrap from '../PlotWrap.svelte'
  import { setDefaultScarfPlotState } from '$lib/stores/scarfPlotsStore.ts'
  import PanelButtonUpload from '$lib/components/Panel/PanelButton/PanelButtonUpload.svelte'
  import PanelButtonDemo from '$lib/components/Panel/PanelButton/PanelButtonDemo.svelte'

  const reloadViews = () => {
    setDefaultScarfPlotState()
  }

</script>

<PlotWrap title="Workspace empty" maxWidth="550px">
    <div slot="body">
        <p>
            All data views erased. However, data is still available in the memory. You can upload new data, load sample data or reload current data.
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
