<script module lang="ts">
  import GeneralInputScaffold from './GeneralInputScaffold.svelte'

  export const meta = {
    title: 'Inputs/GeneralInputScaffold',
    component: GeneralInputScaffold,
    tags: ['autodocs'],
    args: {
      label: 'Any input works',
      id: 'input_id',
    },
  }
</script>

<script>
  import { Story } from '@storybook/addon-svelte-csf'
</script>

<Story name="Default">
  <GeneralInputScaffold {...meta.args}>
    <input type="text" />
  </GeneralInputScaffold>
</Story>
<Story name="Checked" args={{ ...meta.args, checked: true }} />
