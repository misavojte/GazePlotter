<!-- What the homepage shows nowhere else: privacy, credibility, where to report. -->
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
    <span>
      <span class="cite-lead">Peer-reviewed.</span> Cite:
      <a href="https://doi.org/10.3758/s13428-026-02959-5" target="_blank"
        >Vojtechovska &amp; Popelka (2026)</a
      >
    </span>
    <a class="oss" href="https://github.com/misavojte/GazePlotter" target="_blank"
      >Free &amp; open source</a
    >
    <a class="report" href="/docs/#report-a-problem">Report a problem</a>
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
    font-size: var(--text-2xs);
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

  .links {
    gap: 16px;
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

  /* Narrowing gives up one piece at a time, least needed first; privacy,
     the claim that answers a fear, stays to the last. */
  .privacy-mid,
  .privacy-short {
    display: none;
  }

  @media (max-width: 1080px) {
    .privacy-full {
      display: none;
    }

    .privacy-mid {
      display: inline;
    }
  }

  @media (max-width: 900px) {
    .cite-lead {
      display: none;
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
</style>
