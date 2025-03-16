<script module lang="ts">
  import GeneralPositionControl from './GeneralPositionControl.svelte'

  export const meta = {
    title: 'Inputs/GeneralPositionControl',
    component: GeneralPositionControl,
    tags: ['autodocs'],
  }
</script>

<script>
  import { Story, Template } from '@storybook/addon-svelte-csf'
</script>

<Template >
  {#snippet children({ args })}
    <GeneralPositionControl {...args}></GeneralPositionControl>
  {/snippet}
</Template>

<Story name="Default" />

<Story name="First" args={{ isFirst: true }} />

<Story name="Last" args={{ isLast: true }} />
