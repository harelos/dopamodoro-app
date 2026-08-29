const http = require('http');

const ORIGINAL = 'https://shop.tigerbrandsglobal.com/nova-list1';
const PORT = process.env.PORT || 10000;

const QA_HEAD = `
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style id="nova-mobile-qa-v1">
  :root { --qa-copy: 16px; --qa-radius: 12px; }
  html { direction: rtl; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; overflow-x: clip; }
  html, body, button, input, select, textarea { font-family: 'Open Sans', Arial, sans-serif !important; }
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; width: 100%; max-width: 100%; overflow-x: clip; font-size: var(--qa-copy); line-height: 1.68; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }

  h1, h2, h3, h4, h5, h6, p, li, a, button, span { font-family: 'Open Sans', Arial, sans-serif !important; }
  h1, h2, h3, h4, h5, h6 { line-height: 1.24 !important; letter-spacing: -0.018em; overflow-wrap: anywhere; }
  h1 { font-size: clamp(27px, 5vw, 38px) !important; }
  h2 { font-size: clamp(23px, 4vw, 31px) !important; }
  h3 { font-size: clamp(19px, 3vw, 24px) !important; }
  h4 { font-size: clamp(17px, 2.4vw, 20px) !important; }
  p, li { font-size: clamp(15.5px, 2vw, 17px) !important; line-height: 1.72 !important; }

  img { max-width: 100% !important; height: auto !important; }
  video { max-width: 100% !important; height: auto; }
  iframe { max-width: 100% !important; }
  svg { max-width: 100%; }

  a, button, [role='button'] { overflow-wrap: anywhere; touch-action: manipulation; }
  button, [role='button'] { min-height: 44px; }

  .container, .container-fluid { width: 100% !important; max-width: 920px !important; margin-left: auto !important; margin-right: auto !important; }

  @media (max-width: 767px) {
    :root { --qa-copy: 16px; }
    body { line-height: 1.66; }
    h1 { font-size: 27px !important; line-height: 1.22 !important; }
    h2 { font-size: 23px !important; line-height: 1.25 !important; }
    h3 { font-size: 19px !important; line-height: 1.30 !important; }
    h4 { font-size: 17px !important; }
    p, li { font-size: 16px !important; line-height: 1.68 !important; }

    .container, .container-fluid { padding-left: 16px !important; padding-right: 16px !important; }
    .row { margin-left: -8px !important; margin-right: -8px !important; }
    .row > * { padding-left: 8px !important; padding-right: 8px !important; }

    img { max-height: none !important; object-fit: contain; }
    a[class*='btn'], button, [role='button'], [class*='button'] { max-width: 100% !important; white-space: normal !important; }

    /* Prevent the common long-page mobile overflow bugs without changing content. */
    table { display: block; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    pre, code { white-space: pre-wrap; overflow-wrap: anywhere; }
  }

  @media (max-width: 420px) {
    h1 { font-size: 25.5px !important; }
    h2 { font-size: 22px !important; }
    h3 { font-size: 18.5px !important; }
    p, li { font-size: 15.8px !important; }
    .container, .container-fluid { padding-left: 14px !important; padding-right: 14px !important; }
  }
</style>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    document.body && document.body.setAttribute('dir', 'rtl');

    const imgs = Array.from(document.images || []);
    imgs.forEach((img, i) => {
      img.decoding = 'async';
      if (i > 1 && !img.hasAttribute('loading')) img.loading = 'lazy';
      if (i === 0) img.fetchPriority = 'high';
    });
  });
</script>`;

function inject(html) {
  let out = html;
  if (!/<base\s/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1><base href="https://shop.tigerbrandsglobal.com/">`);
  }
  if (/<\/head>/i.test(out)) return out.replace(/<\/head>/i, `${QA_HEAD}</head>`);
  return QA_HEAD + out;
}

async function fetchOriginal() {
  const response = await fetch(ORIGINAL, {
    headers: {
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`Origin returned ${response.status}`);
  return response.text();
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, origin: ORIGINAL, mode: 'isolated-qa-proxy' }));
    }

    if (req.url === '/debug-source') {
      const html = await fetchOriginal();
      res.writeHead(200, {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow'
      });
      return res.end(html);
    }

    const html = await fetchOriginal();
    const output = inject(html);
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer-when-downgrade'
    });
    return res.end(output);
  } catch (error) {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end(`Nova mobile QA proxy could not load the origin page.\n${error.message}`);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Nova mobile QA proxy listening on ${PORT}`);
});
