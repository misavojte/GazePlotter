<script lang="ts">
  import { InputCheck } from '$lib/shared/components'
  import type { BulkContext } from './common'

  interface Props {
    bulk: BulkContext<{ hideNoAoi?: boolean }>
  }

  let { bulk }: Props = $props()

  const hideNoAoi = $derived(bulk.common(s => s.hideNoAoi ?? false))
</script>

<div class="sub-group">
  <div class="legend">Hide data</div>
  <InputCheck
    label="No AOI data"
    appearance="compact"
    size="xs"
    checked={hideNoAoi.value}
    mixed={hideNoAoi.mixed}
    onchange={e => bulk.update({ hideNoAoi: (e as CustomEvent<boolean>).detail })}
  />
</div>

<style>
  .sub-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    margin-top: 4px;
  }

  .sub-group .legend {
    font-size: 11px;
    font-weight: 400;
    color: var(--c-darkgrey);
    line-height: 1.2;
    letter-spacing: 0.01em;
  }
</style>
