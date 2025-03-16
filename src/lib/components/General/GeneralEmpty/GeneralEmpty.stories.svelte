<script module lang="ts">
  import GeneralEmpty from './GeneralEmpty.svelte'

  export const meta = {
    title: 'Inputs/GeneralEmpty',
    component: GeneralEmpty,
    tags: ['autodocs'],
    args: {
      message: 'This is a default empty message.',
    },
  }
</script>

<script>
  import { Story, Template } from '@storybook/addon-svelte-csf'
</script>

<Template >
  {#snippet children({ args })}
    <GeneralEmpty {...args} />
  {/snippet}
</Template>

<Story name="Default" />
<Story
  name="Long empty text"
  args={{
    message:
      'Case felt the edge of the room where Case waited. It was disturbing to think of the Flatline as a gliding cursor struck sparks from the missionaries.',
  }}
/>
