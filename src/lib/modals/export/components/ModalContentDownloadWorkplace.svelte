<script lang="ts">
  import { GeneralButtonMajor, GeneralInputText } from '$lib/shared/components'
  import GeneralSelect from '$lib/shared/components/GeneralSelect.svelte'
  import GeneralInfoCallout from '$lib/shared/components/GeneralInfoCallout.svelte'
  import SectionHeader from '$lib/modals/shared/components/SectionHeader.svelte'
  import { WorkplaceDownloader } from '$lib/modals/export/class/WorkplaceDownloader.js'
  import { getData } from '$lib/gaze-data/front-process/stores/dataStore.js'

  let type = $state('inner-json')
  let fileName = $state('GazePlotter-Export')

  const tip =
    'TIP: You can export individual visualisations using their options menu.'
  const options = [
    {
      value: 'inner-json',
      label: 'GazePlotter',
      calloutHint: {
        title: 'GazePlotter Format',
        paragraphs: [
          'Use this format if you want to import the data back into GazePlotter.',
          'This keeps the layout and the settings of each visualisation, allowing simple dashboard sharing using relatively small JSON.',
          tip,
        ],
      },
    },
    {
      value: 'csv',
      label: 'CSV',
      calloutHint: {
        title: 'CSV Format',
        paragraphs: [
          'Exports all data into a single CSV file.',
          'This format is compatible with most spreadsheet applications and data analysis tools.',
          tip,
        ],
      },
    },
    {
      value: 'individual-csv',
      label: 'Individual CSV',
      calloutHint: {
        title: 'Individual CSV Format',
        paragraphs: [
          'Creates separate CSV files for each recording.',
          'Useful when you need to analyze recordings separately or share individual files.',
          tip,
        ],
      },
    },
  ]

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

  const selectedOption = $derived(options.find(opt => opt.value === type))
</script>

<div class="container">
  <section class="section">
    <SectionHeader text="Export Format" />
    <div class="content">
      <GeneralSelect label="Type" {options} bind:value={type} />
      {#if selectedOption?.calloutHint}
        <GeneralInfoCallout
          title={selectedOption.calloutHint.title}
          paragraphs={selectedOption.calloutHint.paragraphs}
        />
      {/if}
    </div>
  </section>

  <section class="section">
    <SectionHeader text="Export Options" />
    <div class="content">
      <GeneralInputText label="File name" bind:value={fileName} />
      <div class="button-container">
        <GeneralButtonMajor onclick={handleSubmit}>Download</GeneralButtonMajor>
      </div>
    </div>
  </section>
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 500px;
    width: 100%;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .button-container {
    margin-top: 0.5rem;
  }
</style>
