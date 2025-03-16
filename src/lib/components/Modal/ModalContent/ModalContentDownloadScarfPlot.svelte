<script lang="ts">
  import GeneralInputNumber from '../../General/GeneralInput/GeneralInputNumber.svelte'
  import GeneralSelectBase from '../../General/GeneralSelect/GeneralSelect.svelte'
  import GeneralInputText from '../../General/GeneralInput/GeneralInputText.svelte'
  import MajorButton from '../../General/GeneralButton/GeneralButtonMajor.svelte'
  import { ScarfDownloader } from '$lib/class/Downloader/ScarfDownloader'
  import type { ScarfGridType } from '$lib/type/gridType'
  import { addErrorToast } from '$lib/stores/toastStore'

  interface Props {
    settings: ScarfGridType
  }

  let { settings }: Props = $props()

  type fileType = '.svg' | '.png' | '.jpg' | '.webp'

  let typeOfExport: fileType = $state('.svg')
  let width = $state(800) /* in px */
  let fileName = $state('GazePlotter-ScarfPlot')

  const options = [
    { value: '.svg', label: 'SVG (recommended)' },
    { value: '.png', label: 'PNG' },
    { value: '.jpg', label: 'JPG' },
    { value: '.webp', label: 'WEBP' },
  ]

  const handleSubmit = () => {
    const scarfPlot = document.getElementById(`scarf-plot-area-${settings.id}`)
    if (!scarfPlot)
      return addErrorToast(
        `No scarf plot with id ${settings.id} found in DOM. Cannot download, report this issue to the developers.`
      )
    const scarfPlotDownloader = new ScarfDownloader(
      fileName,
      typeOfExport,
      width,
      scarfPlot
    )
    scarfPlotDownloader.download()
  }
</script>

<GeneralInputNumber label="Width in px" bind:value={width} />
<GeneralSelectBase
  label="Output file type"
  {options}
  bind:value={typeOfExport}
/>
<GeneralInputText label="Output file name" bind:value={fileName} />
<MajorButton onclick={handleSubmit}>Download</MajorButton>
