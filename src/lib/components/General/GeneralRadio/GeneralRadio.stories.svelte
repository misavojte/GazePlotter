<script context="module" lang="ts">
  import GeneralRadio from './GeneralRadio.svelte'

  export const meta = {
    title: 'Inputs/GeneralRadio',
    component: GeneralRadio,
    tags: ['autodocs'],
    args: {
      options: [
        { value: 'apples', label: '🍏 Apples' },
        { value: 'bananas', label: '🍌 Bananas' },
        { value: 'oranges', label: '🍊 Oranges' },
      ],
      legend: 'My favourite fruit',
    },
  }
</script>

<script>
  import { Story, Template } from '@storybook/addon-svelte-csf'
</script>

<Template let:args>
  <GeneralRadio {...args}></GeneralRadio>
</Template>

<Story name="Default" />

<Story
  name="Last option preselected"
  args={{ value: meta.args.options[meta.args.options.length - 1].value }}
/>
