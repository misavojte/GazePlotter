<script lang="ts">
  import { GeneralButtonMajor } from '$lib/shared/components'
  import { demoData } from '$lib/gaze-data/front-process/const/demoDataTwo'
  import { data } from '$lib/gaze-data/front-process/stores/dataStore'
  import { addSuccessToast } from '$lib/toaster'
  import {
    processingFileStateStore,
    initializeGridStateStore,
  } from '$lib/workspace'

  let isDisabled = $derived($processingFileStateStore === 'processing')

  const handleClick = async () => {
    data.set(demoData)
    initializeGridStateStore()
    processingFileStateStore.set('done')
    addSuccessToast('Demo data loaded')
  }
</script>

<GeneralButtonMajor {isDisabled} onclick={handleClick}>
  Reload demo
</GeneralButtonMajor>
