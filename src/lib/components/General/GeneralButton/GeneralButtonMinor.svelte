<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  export let isDisabled = false
  export let marginTop = '7px' /* For usage with compact selects in headers of plots */

  const handleClick = () => {
    dispatch('click')
  }
</script>

<button disabled={isDisabled} on:click={handleClick} style="margin-top: {marginTop}">
    <slot></slot>
</button>

<style>
    button {
        background: none;
        border: 1px solid rgba(0, 0, 0, 0.23);
        border-radius: 4px;
        color: rgba(0, 0, 0, 0.87);
        padding: 0;
        text-align: center;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        width: 34px;
        height: 34px;
        cursor: pointer;
    }
    button:hover {
        border: 1px solid #cd1404;
        color: #cd1404;
    }
    button:disabled {
        cursor: not-allowed;
        color: rgba(0, 0, 0, 0.26);
        border: 1px solid rgba(0, 0, 0, 0.12);
    }
</style>
