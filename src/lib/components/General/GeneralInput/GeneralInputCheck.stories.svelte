<script context="module" lang="ts">
  import GeneralInputCheck from './GeneralInputCheck.svelte'

  export const meta = {
    title: 'Inputs/GeneralInputCheck',
    component: GeneralInputCheck,
    tags: ['autodocs'],
    args: {
      label: 'I ❤️ scarfplots label',
    },
  }
</script>

<script>
  import { Story, Template } from '@storybook/addon-svelte-csf'
</script>

<Template let:args>
  <GeneralInputCheck {...args} />
</Template>

<Story name="Default" />
<Story name="Checked" args={{ ...meta.args, checked: true }} />
