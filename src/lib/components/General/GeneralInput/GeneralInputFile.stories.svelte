<script module lang="ts">
  import GeneralInputFile from './GeneralInputFile.svelte'

  export const meta = {
    title: 'Inputs/GeneralInputFile',
    component: GeneralInputFile,
    tags: ['autodocs'],
    args: {
      label: 'My favourite file',
    },
  }
</script>

<script>
  import { Story, Template } from '@storybook/addon-svelte-csf'
</script>

<Template >
  {#snippet children({ args })}
    <GeneralInputFile {...args} />
  {/snippet}
</Template>

<Story name="Default" />

<Story
  name="Accept only pdfs"
  args={{ ...meta.args, label: 'My favourite pdf', accept: ['.pdf'] }}
/>

<Story
  name="Accepts multiple files"
  args={{ ...meta.args, label: 'My favourite files', multiple: true }}
/>
