<script lang="ts">
  import MajorButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import GeneralInputText from '$lib/components/General/GeneralInput/GeneralInputText.svelte'
  import GeneralSelect from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import { WorkplaceDownloader } from '$lib/class/Downloader/WorkplaceDownloader.js'
  import { getData } from '$lib/stores/dataStore.js'

  let type = 'inner-json'
  let fileName = 'GazePlotter-Workplace'

  const options = [
    {
      value: 'inner-json',
      label: 'GazePlotter',
    },
    {
      value: 'csv',
      label: 'CSV',
    },
    {
      value: 'individual-csv',
      label: 'Individual CSV',
    },
  ]

  console.log(options)

  const handleSubmit = () => {
    const downloader = new WorkplaceDownloader()
    if (type === 'inner-json') {
      downloader.download(getData(), fileName)
    } else if (type === 'csv') {
      downloader.downloadCSV(getData(), fileName)
    } else {
      downloader.downloadIndividualCSV(getData(), fileName)
    }
  }
</script>

<GeneralSelect label="Export type" {options} bind:value={type} />
<GeneralInputText label="File name" bind:value={fileName} />
<div class="mt-30">
  <MajorButton on:click={handleSubmit}>Download</MajorButton>
</div>

<style>
  .mt-30 {
    margin-top: 30px;
  }
</style>
