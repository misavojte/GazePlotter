<script lang="ts">
  import { ScanGraphDownloader } from '$lib/class/Downloader/ScanGraphDownloader'
  import GeneralSelectBase from '../../General/GeneralSelect/GeneralSelect.svelte'
  import GeneralInputText from '../../General/GeneralInput/GeneralInputText.svelte'
  import MajorButton from '../../General/GeneralButton/GeneralButtonMajor.svelte'
  import { getStimuliOptions } from '$lib/plots/shared/utils/sharedPlotUtils'
  let stimulusId = $state('0')
  let fileName = $state('GazePlotter-ScanGraph')

  const options = getStimuliOptions()

  const handleSubmit = () => {
    console.log(stimulusId)
    const downloader = new ScanGraphDownloader()
    downloader.download(parseInt(stimulusId), fileName)
  }
</script>

<GeneralSelectBase label="Stimulus" {options} bind:value={stimulusId} />
<GeneralInputText label="File name" bind:value={fileName} />
<div class="mt-30">
  <MajorButton onclick={handleSubmit}>Download</MajorButton>
</div>

<style>
  .mt-30 {
    margin-top: 30px;
  }
</style>
