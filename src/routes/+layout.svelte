<script>
  import '../app.css'
  import { Footer, Header } from './components'
  import { afterNavigate } from '$app/navigation'
  import { clear } from '$lib/toaster/toastState.svelte'

  /** @type {{children?: import('svelte').Snippet}} */
  let { children } = $props()

  afterNavigate(() => {
    clear()
  })
</script>

<Header />
{@render children?.()}
<Footer />
