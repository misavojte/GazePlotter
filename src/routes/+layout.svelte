<script>
  import '../app.css'
  import { Footer, Header } from './components'
  /** @type {{children?: import('svelte').Snippet}} */
  let { children } = $props()
</script>

<Header />
{@render children?.()}
<Footer />
