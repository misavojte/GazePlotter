<script context="module" lang="ts">
  import GeneralButtonMajor from './GeneralButtonMajor.svelte'

  export const meta = {
    title: 'Inputs/GeneralButtonMajor',
    component: GeneralButtonMajor,
    tags: ['autodocs'],
  }
</script>

<script>
  import { Story, Template } from '@storybook/addon-svelte-csf'
</script>

<Template let:args>
  <GeneralButtonMajor {...args}>Primary Button</GeneralButtonMajor>
</Template>

<Story name="Default" />

<Story name="Disabled" args={{ isDisabled: true }} />
