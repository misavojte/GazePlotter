<script lang="ts">
  import { GeneralButtonMajor, GeneralInputText } from '$lib/shared/components'
  import GeneralSelect from '$lib/shared/components/GeneralSelect.svelte'
  import { WorkplaceDownloader } from '$lib/modals/export/class/WorkplaceDownloader.js'
  import { getData } from '$lib/stores/dataStore.js'

  let type = $state('inner-json')
  let fileName = $state('GazePlotter-Workplace')

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
      downloader.downloadIndividualCSV(getData(), fileName, true)
    }
  }
</script>

<GeneralSelect label="Export type" {options} bind:value={type} />
<GeneralInputText label="File name" bind:value={fileName} />
<div class="mt-30">
  <GeneralButtonMajor onclick={handleSubmit}>Download</GeneralButtonMajor>
</div>

<style>
  .mt-30 {
    margin-top: 30px;
  }
</style>
