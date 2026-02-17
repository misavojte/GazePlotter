<script lang="ts">
  // Format the build date
  const buildDate = new Date(__BUILD_DATE__)
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(buildDate)

  // Use the version from vite.config.ts
  const version = __APP_VERSION__
</script>

<footer class="border-t">
  <div class="footer-content">
    <p>GazePlotter, version {version} ({formattedDate})</p>
    <p>
      Coded & designed by <a href="https://vojtechovska.com" target="_blank"
        >Michaela Vojtěchovská</a
      >, idea by Stanislav Popelka
    </p>
    <p>
      <a href="https://geoinformatics.upol.cz" target="_blank" rel="nofollow"
        >Department of Geoinformatics</a
      >, Palacký University Olomouc
    </p>
    <img
      class="up-logo"
      src="/logos/upol.png"
      alt="Palacký University Olomouc logo"
      width="300"
      height="137"
    />
  </div>
</footer>

<style>
  footer {
    background-color: var(--c-white);
  }

  .footer-content {
    text-align: center;
    padding: 32px;
    font-size: 14px;
    box-sizing: border-box;
    width: 100%;
    margin-inline: auto;
  }

  .up-logo {
    margin-top: 30px;
    width: 150px;
    height: auto;
    user-select: none;
  }

  .border-t {
    border-top: #5858583a 1px solid;
  }

  footer p {
    margin: 0;
    line-height: 1.5;
    color: #3c3c43bf;
  }

  footer p a {
    color: inherit;
    text-decoration: none;
    border-bottom: 1px dotted;
    transition: all 0.3s ease-in-out;
  }

  footer p a:hover,
  footer p a:focus {
    color: var(--c-black);
  }

  @media only screen and (max-width: 1000px) {
    .footer-content {
      padding-inline: 24px;
    }
  }

  @media only screen and (max-width: 740px) {
    footer {
      font-size: 0.9rem;
    }
    .footer-content {
      padding-inline: 22px;
    }
  }

  @media only screen and (max-width: 665px) {
    footer {
      font-size: 0.8rem;
    }
    .footer-content {
      padding-inline: 20px;
    }
  }

  @media only screen and (max-width: 540px) {
    .footer-content {
      padding-inline: 18px;
    }
  }

  @media only screen and (max-width: 420px) {
    .footer-content {
      padding-inline: 15px;
    }
  }

  @media only screen and (max-width: 380px) {
    .footer-content {
      padding-inline: 12px;
    }
  }
</style>
