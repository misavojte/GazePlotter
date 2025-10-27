<script lang="ts">
  interface Props {
    /** Question title */
    title?: string;
    /** Question instructions */
    instructions?: string;
    /** Placeholder text for the textarea */
    placeholder?: string;
    /** Callback when user submits feedback */
    onComplete?: (feedback: string) => void;
    /** Optional CSS class for custom styling */
    class?: string;
    /** Optional initial value to pre-populate feedback */
    initialValue?: string | null;
    /** Callback when value changes (for parent state management) */
    onValueChange?: (value: string, isComplete: boolean) => void;
  }

  let {
    title = 'Please provide your feedback',
    instructions = 'Share your thoughts below',
    placeholder = 'Write your feedback here...',
    onComplete,
    class: className = '',
    initialValue = null,
    onValueChange
  }: Props = $props();
  
  let feedbackText = $state(initialValue || '');
  const CHARACTER_LIMIT = 2000;
  let remainingChars = $derived(CHARACTER_LIMIT - feedbackText.length);
  
  // Expose value and isComplete for parent component - update via effect
  let value = $state<string>(initialValue || '');
  let isComplete = $state(false);

  // Update exposed values when feedbackText changes
  $effect(() => {
    value = feedbackText;
    isComplete = feedbackText.trim() !== '';

    if (onValueChange) {
      onValueChange(feedbackText, feedbackText.trim() !== '');
    }

    if (onComplete && feedbackText.trim() !== '') {
      onComplete(feedbackText);
    }
  });
</script>

<div class="feedback-question" class:className>
  <div class="question-header">
    <h2>{title}</h2>
    <p class="instructions">
      {instructions}
    </p>
  </div>

  <div class="feedback-container">
    <textarea
      bind:value={feedbackText}
      class="feedback-textarea"
      placeholder={placeholder}
      maxlength={CHARACTER_LIMIT}
      rows="8"
    ></textarea>
    
    <div class="feedback-footer">
      <span class="char-count" class:at-limit={remainingChars <= 50}>
        {remainingChars} characters remaining
      </span>
    </div>
  </div>
</div>

<style>
  .feedback-question {
    width: 100%;
    margin: 0 auto;
    padding: 0;
    box-sizing: border-box;
  }

  .question-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .question-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--c-black);
    margin: 0 0 0.75rem 0;
  }

  .instructions {
    color: var(--c-darkgrey);
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0;
  }

  .feedback-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .feedback-textarea {
    width: 100%;
    padding: 1rem;
    border: 2px solid var(--c-lightgrey);
    border-radius: var(--rounded-md);
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.5;
    resize: vertical;
    transition: border-color 0.3s ease;
    box-sizing: border-box;
  }

  .feedback-textarea:focus {
    outline: none;
    border-color: var(--c-success);
  }

  .feedback-footer {
    display: flex;
    justify-content: flex-end;
  }

  .char-count {
    color: var(--c-darkgrey);
    font-size: 0.85rem;
  }

  .char-count.at-limit {
    color: var(--c-error);
    font-weight: 500;
  }

  @media (max-width: 640px) {
    .feedback-question {
      padding: 0.75rem 0.5rem;
    }

    .question-header h2 {
      font-size: 1.1rem;
    }

    .instructions {
      font-size: 0.85rem;
    }
  }
</style>

