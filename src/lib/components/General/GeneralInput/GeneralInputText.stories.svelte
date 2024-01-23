<script context="module" lang="ts">
  import GeneralInputText from './GeneralInputText.svelte'

  export const meta = {
    title: 'Inputs/GeneralInputText',
    component: GeneralInputText,
    tags: ['autodocs'],
    args: {
      label: 'legend label',
      value: 'lorem ipsum',
    },
  }
</script>

<script>
  import { Story, Template } from '@storybook/addon-svelte-csf'
</script>

<Template let:args>
  <GeneralInputText {...args} />
</Template>

<Story name="Default" />
