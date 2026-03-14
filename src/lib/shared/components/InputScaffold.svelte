<script lang="ts">
  /**
   * InputScaffold is a base component that provides consistent styling and structure
   * for form input components. It handles the layout of labels and input elements,
   * ensuring consistent spacing and accessibility across all input types.
   *
   * This component is used as a wrapper by other input components (Text, Number, File, etc.)
   * to maintain a consistent look and feel throughout the application.
   *
   * @example
   * ```svelte
   * <InputScaffold label="Username" id="username">
   *   <input type="text" />
   * </InputScaffold>
   * ```
   */
  interface Props {
    /** The text label for the input field */
    label: string
    /** The unique identifier for the input field */
    id: string
    /** Removes the default bottom margin for dense inline layouts */
    compact?: boolean
    /** The input element(s) to be wrapped by the scaffold */
    children?: import('svelte').Snippet<[any]>
  }

  let { label, id, compact = false, children }: Props = $props()
</script>

<div class="input" class:compact>
  <label for={id}>{label}</label>
  {@render children?.({ itemtype: 'input' })}
</div>

<style>
  .input {
    display: flex;
    flex-direction: column;
    margin-bottom: 15px;
    gap: 4px;
  }

  .input.compact {
    margin-bottom: 0;
  }

  label {
    font-size: 12px;
    color: var(--c-darkgrey);
    font-weight: 400;
    line-height: 1.2;
    letter-spacing: 0.01em;
  }
</style>
