/**
 * Context the job hands to formats — the only two capabilities a format may
 * use besides the sink. Injected (never imported) so the kernel runs
 * identically inside the Web Worker, in tests, and in any future host.
 */
export interface IngestContext {
  /**
   * Ask the user for input via a registered prompt (see
   * `src/lib/data/ingest/prompts.ts` for the main-thread prompt registry).
   * Resolves with the user's value, or the prompt's cancel fallback.
   *
   * INVARIANT: the job processes sources sequentially, so at most one
   * prompt is ever pending — implementations may assume no concurrency.
   */
  prompt(promptId: string, payload?: unknown): Promise<string>

  /**
   * Report consumed input bytes for progress display. `force` bypasses the
   * host's throttling (used after coarse-grained units like a whole zip).
   */
  reportBytes(byteLength: number, force?: boolean): void
}
