<script context="module" lang="ts">
  import GeneralInputFile from './GeneralInputFile.svelte'

  export const meta = {
    title: 'Inputs/GeneralInputFile',
    component: GeneralInputFile,
    tags: ['autodocs'],
    args: {
      legend: 'My favourite file',
    },
  }
</script>

<script>
  import { Story, Template } from '@storybook/addon-svelte-csf'
</script>

<Template let:args>
  <GeneralInputFile {...args} />
</Template>

<Story name="Default" />

<Story
  name="Accept only pdfs"
  args={{ ...meta.args, legend: 'My favourite pdf', accept: ['.pdf'] }}
/>

<Story
  name="Accepts multiple files"
  args={{ ...meta.args, legend: 'My favourite files', multiple: true }}
/>
