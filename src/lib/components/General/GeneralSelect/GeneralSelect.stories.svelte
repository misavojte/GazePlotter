<script context="module" lang="ts">
  import GeneralSelect from './GeneralSelect.svelte'

  export const meta = {
    title: 'Inputs/GeneralSelect',
    component: GeneralSelect,
    tags: ['autodocs'],
    args: {
      options: [
        { value: 'apples', label: '🍏 Apples' },
        { value: 'bananas', label: '🍌 Bananas' },
        { value: 'oranges', label: '🍊 Oranges' },
      ],
      label: 'My favourite fruit',
    },
  }
</script>

<script>
  import { Story, Template } from '@storybook/addon-svelte-csf'
</script>

<Template let:args>
  <div style={'background: white;'}>
    <GeneralSelect {...args}></GeneralSelect>
  </div>
</Template>

<Story name="Default" />

<Story name="Disabled" args={{ disabled: true }} />

<Story name="Compact" args={{ compact: true }} />

<Story name="Compact disabled" args={{ compact: true, disabled: true }} />

<Story
  name="Last option preselected"
  args={{ value: meta.args.options[meta.args.options.length - 1].value }}
/>
