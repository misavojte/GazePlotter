<script lang="ts">
  import { getParticipants } from '$lib/stores/dataStore'
  import { removeGroup } from '$lib/stores/participantsGroupStore'
  import type { ParticipantsGroup } from '$lib/type/Data/ParticipantsGroup'
  import Pencil from 'lucide-svelte/icons/pencil'
  import Trash from 'lucide-svelte/icons/trash'
  import TagsInput from '../../TagsInput/TagsInput.svelte'

  interface Props {
    group: ParticipantsGroup;
  }

  let { group }: Props = $props();

  const participants = getParticipants().map(d => d.displayedName)
</script>

<div class="wrapper">
  <div class="header">
    <div class="group-name">{group.name}</div>
    <button>
      <Pencil size={'1em'} />
    </button>
    <button onclick={() => removeGroup(group.id)}>
      <Trash size={'1em'} />
    </button>
  </div>
  <TagsInput suggestions={participants} />
</div>

<style>
  .wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 0.5em;
    & :last-child {
      margin-left: auto;
    }
  }
  .group-name {
    font-weight: bold;
  }
  button {
    background: white;
    border: none;
    padding: 0.5em;
    border-radius: var(--rounded);
    aspect-ratio: 1;
    border: 1px solid lightgray;
    transition: background 0.25s;
    cursor: pointer;
    &:hover {
      background: lightgray;
    }
  }
</style>
