<script lang="ts">
  import GeneralInputNumber from '../../General/GeneralInput/GeneralInputNumber.svelte'
  import GeneralSelectBase from '../../General/GeneralSelect/GeneralSelect.svelte'
  import GeneralInputText from '../../General/GeneralInput/GeneralInputText.svelte'
  import MajorButton from '../../General/GeneralButton/GeneralButtonMajor.svelte'
  import { ScarfDownloader } from '$lib/class/Downloader/ScarfDownloader.js'

  export let scarfId: number

  type fileType = '.svg' | '.png' | '.jpg' | '.webp'

  let typeOfExport: fileType = '.svg'
  let width = 800 /* in px */
  let fileName = 'GazePlotter-ScarfPlot'

  const options = [
    { value: '.svg', label: 'SVG (recommended)' },
    { value: '.png', label: 'PNG' },
    { value: '.jpg', label: 'JPG' },
    { value: '.webp', label: 'WEBP' },
  ]

  const handleSubmit = () => {
    const scarfPlot = document.getElementById(`scarf-plot-area-${scarfId}`)
    if (!scarfPlot)
      throw new Error(`No scarf plot with id ${scarfId} found in DOM.`)
    const scarfPlotDownloader = new ScarfDownloader(
      fileName,
      typeOfExport,
      width,
      scarfPlot
    )
    scarfPlotDownloader.download()
  }
</script>

<GeneralInputNumber legend="Width in px" bind:value={width} />
<GeneralSelectBase
  label="Output file type"
  {options}
  bind:value={typeOfExport}
/>
<GeneralInputText legend="Output file name" bind:value={fileName} />
<MajorButton on:click={handleSubmit}>Download</MajorButton>
