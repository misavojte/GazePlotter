<script context="module" lang="ts">
  import GeneralInputNumber from '../GeneralInput/GeneralInputNumber.svelte'
  import GeneralRadio from '../GeneralRadio/GeneralRadio.svelte'
  import GeneralFieldset from './GeneralFieldset.svelte'

  export const meta = {
    title: 'Inputs/GeneralFieldset',
    component: GeneralFieldset,
    tags: ['autodocs'],
    args: {
      legend: 'legend label',
    },
  }
</script>

<script>
  import { Story, Template } from '@storybook/addon-svelte-csf'
</script>

<Template let:args>
  <GeneralFieldset {...args}>
    <GeneralInputNumber label="A number input" />
    <GeneralRadio
      options={[
        { value: 'this_stimulus', label: 'This stimulus' },
        { value: 'all_stimuli', label: 'All stimuli' },
      ]}
      legend="A radio input"
    />
  </GeneralFieldset>
</Template>

<Story name="Default" />
