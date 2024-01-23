<script context="module" lang="ts">
  import GeneralButtonMinor from './GeneralButtonMinor.svelte'

  export const meta = {
    title: 'Inputs/GeneralButtonMinor',
    component: GeneralButtonMinor,
    tags: ['autodocs'],
  }
</script>

<script>
  import { Story, Template } from '@storybook/addon-svelte-csf'
  import User from 'lucide-svelte/icons/user'
</script>

<Template let:args>
  <GeneralButtonMinor {...args}><User /></GeneralButtonMinor>
</Template>

<Story name="Default" />

<!-- TODO: find out why this is not working here but workin for minor button -->
<Story name="Disabled" args={{ isDisabled: true }} />

<Story name="with Text">
  <GeneralButtonMinor isIcon={false}>Minor Button</GeneralButtonMinor>
</Story>
