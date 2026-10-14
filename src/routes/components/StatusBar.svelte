<!-- The docs landing page in one line: privacy, who makes it, how to cite,
     open source, where to report. Each link lands on its docs section. -->
<footer class="status-bar">
  <p class="privacy">
    <!-- Solid body, stroked shackle: lucide's lock only comes outlined. -->
    <svg class="icon" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" stroke-width="2.5" />
      <rect x="3" y="10" width="18" height="12" rx="2.5" fill="currentColor" />
    </svg>
    <span class="clip privacy-full">Fully private. Your files open in your browser and are never sent to a server.</span>
    <span class="clip privacy-mid">Fully private. Your files never leave your browser.</span>
    <span class="privacy-short">Fully private. Runs locally.</span>
  </p>
  <p class="links">
    <span class="affiliation"
      >Made at <a href="/docs/#who-makes-gazeplotter">Palacký University Olomouc</a></span
    >
    <span class="cite">
      <span class="cite-lead">Peer-reviewed.</span> Cite:
      <a href="/docs/#how-to-cite">Vojtechovska &amp; Popelka (2026)</a>
    </span>
    <span class="oss"
      ><a href="https://github.com/misavojte/GazePlotter" target="_blank"
        >Free &amp; open source</a
      ></span
    >
    <span class="report"><a href="/docs/#report-a-problem">Report a problem</a></span>
  </p>
</footer>

<style>
  .status-bar {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    height: var(--site-statusbar-height);
    /* The header's 8px, so the lock lines up under the brand mark. */
    padding: 0 8px;
    background-color: var(--c-white);
    border-top: 1px solid var(--c-border);
    /* A caption under the canvas: the caption step, not the badge step, in
       the optical cut drawn for it. */
    font-family: var(--font-small);
    font-size: var(--text-xs);
    color: var(--c-darkgrey);
  }

  p {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    min-width: 0;
    white-space: nowrap;
  }

  .icon {
    flex-shrink: 0;
  }

  .clip {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Hairlines between the pieces, the header's divider idiom. */
  .links {
    gap: 0;
  }

  .links > * + * {
    margin-left: 12px;
    padding-left: 12px;
    border-left: 1px solid var(--c-border);
  }

  a {
    color: inherit;
    text-decoration: underline;
    text-decoration-color: var(--c-midgrey);
    text-underline-offset: 2px;
    transition: color var(--transition-fast) ease;
  }

  a:hover {
    color: var(--c-black);
    text-decoration-color: currentColor;
  }

  a:focus-visible {
    outline: 2px solid var(--c-info);
    outline-offset: 2px;
    border-radius: var(--rounded);
  }

  /* Narrowing gives up one piece at a time, least needed first; privacy,
     the claim that answers a fear, stays to the last. */
  .privacy-mid,
  .privacy-short {
    display: none;
  }

  @media (max-width: 1240px) {
    .privacy-full {
      display: none;
    }

    .privacy-mid {
      display: inline;
    }
  }

  @media (max-width: 1040px) {
    .cite-lead {
      display: none;
    }
  }

  @media (max-width: 940px) {
    .affiliation {
      display: none;
    }

    /* Now first in the row: no hairline before it. */
    .cite {
      margin-left: 0;
      padding-left: 0;
      border-left: none;
    }
  }

  @media (max-width: 820px) {
    .oss {
      display: none;
    }
  }

  @media (max-width: 700px) {
    .report {
      display: none;
    }
  }

  @media (max-width: 560px) {
    .links {
      display: none;
    }
  }

  @media (max-width: 380px) {
    .privacy-mid {
      display: none;
    }

    .privacy-short {
      display: inline;
    }
  }

  /* Phones have no room to spare: the strip goes and the canvas takes its
     row (app.css zeroes --site-statusbar-height at the same width). The
     privacy claim stays one tap away in the docs. */
  @media (max-width: 768px) {
    .status-bar {
      display: none;
    }
  }
</style>
