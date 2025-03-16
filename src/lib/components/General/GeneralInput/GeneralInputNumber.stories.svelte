<script module lang="ts">
  import GeneralInputNumber from './GeneralInputNumber.svelte'

  export const meta = {
    title: 'Inputs/GeneralInputNumber',
    component: GeneralInputNumber,
    tags: ['autodocs'],
    args: {
      label: 'My favourite number',
    },
  }
</script>

<script>
  import { Story, Template } from '@storybook/addon-svelte-csf'
</script>

<Template >
  {#snippet children({ args })}
    <GeneralInputNumber {...args} />
  {/snippet}
</Template>

<Story name="Default" />

<Story name="With min value" args={{ ...meta.args, value: 4, min: 5 }} />
