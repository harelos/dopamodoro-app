// Dopamodoro Mobile — Google Play Billing for a TWA (Digital Goods API)
// ---------------------------------------------------------------------------
// This build ships as a Trusted Web Activity (PWABuilder / Bubblewrap) wrapping
// the Netlify-hosted web app. Inside a TWA, Google Play Billing is reached through
// the *Digital Goods API* (window.getDigitalGoodsService) + the *Payment Request
// API* — NOT Cordova plugins. Prereqs for it to actually charge:
//   1. Wrapper has Play Billing enabled  (Bubblewrap twa-manifest.json:
//        "features": { "playBilling": { "enabled": true } } ; PWABuilder: tick
//        "Include Google Play billing").
//   2. Products created in Play Console (same IDs as PRODUCTS below).
//   3. App published to a Play track & tested from Play with a license tester.
//
// Loaded as a classic script AFTER app.js. Everything is guarded: in a plain
// browser (dev) getDigitalGoodsService is undefined — the paywall still opens,
// buy explains it only works in the installed app. Entitlement is cached in
// `dopamodoroState` and broadcast via `dopamodoro-pro-changed` for app.js.
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  // ---- Offer, locked ----
  // Prices are the ones you set in Play Console; the Digital Goods API fetches
  // localized strings at runtime. These fallbacks show if fetch hasn't happened.
  const PRODUCTS = {
    yearly:   { id: 'dopamodoro_pro_yearly',   kind: 'sub',  price: '$59.99', per: '/year',  tag: '7-day free trial · save 50%' },
    monthly:  { id: 'dopamodoro_pro_monthly',  kind: 'sub',  price: '$9.99',  per: '/month', tag: '7-day free trial' },
    lifetime: { id: 'dopamodoro_pro_lifetime', kind: 'once', price: '$129',   per: ' once',  tag: 'Pay once, keep forever' }
  };
  const PRODUCT_LIST = [PRODUCTS.yearly, PRODUCTS.monthly, PRODUCTS.lifetime];

  // Free-tier limits other code can read via Billing.LIMITS.
  const LIMITS = { folders: 3, northStars: 1 };

  const BILLING_METHOD = 'https://play.google.com/billing';
  let dgs = null;            // DigitalGoodsService (Play Billing)
  let ready = false;
  let selectedKey = 'yearly';
  let _isPro = false;        // cached entitlement (app.js is a module — private scope)

  // ---------- storage (mirrors app.js STORAGE_KEY, independent + safe) ----------
  const KEY = 'dopamodoroState';
  const cap = (typeof window !== 'undefined' && window.Capacitor) ? window.Capacitor : null;
  const Prefs = cap?.Plugins?.Preferences || null;
  async function readStore() {
    try {
      if (Prefs) { const { value } = await Prefs.get({ key: KEY }); return value ? JSON.parse(value) : {}; }
      const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : {};
    } catch { return {}; }
  }
  async function writePremium(isPro) {
    _isPro = !!isPro;
    // Persist directly (app.js is a module — its `state` isn't in our scope).
    try {
      const s = await readStore(); s.isPremium = _isPro;
      if (Prefs) await Prefs.set({ key: KEY, value: JSON.stringify(s) });
      else localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
    updateProUI(_isPro);
    // app.js listens for this to sync its in-memory state + re-render live.
    document.dispatchEvent(new CustomEvent('dopamodoro-pro-changed', { detail: { isPro: _isPro } }));
  }

  function isProNow() { return _isPro; }

  function updateProUI(isPro) {
    const badge = document.getElementById('proBadge');
    if (badge) badge.classList.toggle('hidden', !isPro);
    const go = document.getElementById('goProBtn');
    if (go) go.classList.toggle('hidden', !!isPro);
  }

  // ---------- Play Billing init (Digital Goods API) ----------
  async function init() {
    updateProUI(isProNow());
    // Available only inside a billing-enabled TWA. Undefined in a normal browser.
    if (typeof window.getDigitalGoodsService !== 'function') return;
    try {
      dgs = await window.getDigitalGoodsService(BILLING_METHOD);
      if (!dgs) return;
      ready = true;
      await refreshPrices();
      await recomputeEntitlement();
    } catch (e) {
      // Service unavailable (old Chrome / billing not enabled in wrapper) — paywall still shows.
      console.warn('[billing] Digital Goods service unavailable', e);
    }
  }

  // Read what Play says the user owns, and flip entitlement.
  async function recomputeEntitlement() {
    if (!dgs || !ready) return;
    try {
      const purchases = await dgs.listPurchases();
      const ids = new Set(PRODUCT_LIST.map(p => p.id));
      const owned = (purchases || []).some(pu => ids.has(pu.itemId));
      // Acknowledge anything not yet acknowledged so Play doesn't auto-refund.
      for (const pu of (purchases || [])) { if (ids.has(pu.itemId)) await ackIfNeeded(pu); }
      writePremium(owned);
    } catch (e) { console.warn('[billing] listPurchases failed', e); }
  }

  // Acknowledgment: server-side (Play Developer API) is the robust path, but the
  // Digital Goods API also exposes a client acknowledge in most Chrome builds.
  // Feature-detected + wrapped so a missing/renamed method never breaks the flow.
  async function ackIfNeeded(pu) {
    try {
      if (pu.acknowledged === true) return;
      if (dgs && typeof dgs.acknowledge === 'function') { await dgs.acknowledge(pu.purchaseToken, 'onetime'); }
    } catch (e) { /* non-fatal; backend can reconcile */ }
  }

  async function refreshPrices() {
    if (!dgs) return;
    try {
      const details = await dgs.getDetails(PRODUCT_LIST.map(p => p.id));
      const byId = {}; (details || []).forEach(d => { byId[d.itemId] = d; });
      PRODUCT_LIST.forEach(p => {
        const d = byId[p.id];
        const amt = d && d.price;                     // { currency, value }
        if (amt && amt.value != null) {
          const cur = amt.currency === 'USD' ? '$' : (amt.currency + ' ');
          p.price = `${cur}${amt.value}`; p.per = '';
        }
      });
    } catch (e) { console.warn('[billing] getDetails failed', e); }
    if (document.getElementById('pwSheet')) renderPlans();
  }

  // ---------- purchase / restore ----------
  async function buy(key) {
    const p = PRODUCTS[key]; if (!p) return;
    if (!dgs || !ready || typeof window.PaymentRequest !== 'function') {
      toast('Purchases only work in the installed app from Google Play.');
      return;
    }
    try {
      const request = new PaymentRequest(
        [{ supportedMethods: BILLING_METHOD, data: { sku: p.id } }],
        { total: { label: 'Dopamodoro Pro', amount: { currency: 'USD', value: '0' } } }
      );
      const response = await request.show();          // opens the Play purchase sheet
      const token = response.details && response.details.token;
      await response.complete('success');
      // Acknowledge, then grant. listPurchases is the source of truth next launch.
      if (token) { try { if (dgs.acknowledge) await dgs.acknowledge(token, 'onetime'); } catch {} }
      writePremium(true);
      toast('Welcome to Pro ✨');
      closePaywall();
    } catch (e) {
      if (e && (e.name === 'AbortError' || /cancel/i.test(e.message || ''))) return; // user dismissed
      console.warn('[billing] purchase failed', e);
      toast('Could not start checkout — try again.');
    }
  }

  async function restore() {
    if (!dgs || !ready) { toast('Open the installed app to restore.'); return; }
    toast('Restoring…');
    try { await recomputeEntitlement(); toast(isProNow() ? 'Pro restored ✓' : 'No purchases found'); }
    catch { toast('Restore failed — try again.'); }
  }

  function toast(msg) {
    try { if (typeof showToast === 'function') { showToast(msg); return; } } catch {}
    const t = document.createElement('div');
    t.className = 'pw-toast'; t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 1900);
  }

  // ---------- paywall UI ----------
  // `trigger` is just for future analytics on which touchpoint converted.
  function openPaywall(trigger) {
    if (isProNow()) { toast('You\'re already Pro ✓'); return; }
    let ov = document.getElementById('pwOverlay');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'pwOverlay'; ov.className = 'pw-overlay';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) closePaywall(); });
    }
    ov.dataset.trigger = trigger || 'manual';
    ov.innerHTML = `
      <div class="pw-sheet" id="pwSheet">
        <button class="pw-close" id="pwClose" aria-label="Close">×</button>
        <div class="pw-head">
          <div class="pw-title">Dopamodoro Pro</div>
          <div class="pw-sub">Your focus, coached. Unlock the AI coach, unlimited folders &amp; goals, and your North Star in full.</div>
        </div>
        <ul class="pw-benefits">
          <li>AI Focus Coach + weekly analysis</li>
          <li>North Star “make it vivid” (all 5 senses) &amp; paths</li>
          <li>Unlimited folders &amp; North Star goals</li>
          <li>Streak freezes, deep insights, daily-wrap suggestions</li>
        </ul>
        <div class="pw-plans" id="pwPlans"></div>
        <button class="pw-cta" id="pwCta">Start 7-day free trial</button>
        <div class="pw-fine">Cancel anytime in Google Play. Trial applies to Monthly &amp; Yearly.</div>
        <button class="pw-restore" id="pwRestore">Restore purchases</button>
      </div>`;
    ov.classList.add('open');
    renderPlans();
    ov.querySelector('#pwClose').addEventListener('click', closePaywall);
    ov.querySelector('#pwRestore').addEventListener('click', restore);
    ov.querySelector('#pwCta').addEventListener('click', () => buy(selectedKey));
  }
  function closePaywall() { document.getElementById('pwOverlay')?.classList.remove('open'); }

  function renderPlans() {
    const wrap = document.getElementById('pwPlans'); if (!wrap) return;
    const order = ['yearly', 'monthly', 'lifetime'];
    wrap.innerHTML = order.map(k => {
      const p = PRODUCTS[k];
      const hero = k === 'yearly';
      return `<button class="pw-plan${selectedKey === k ? ' sel' : ''}${hero ? ' hero' : ''}" data-k="${k}">
        ${hero ? '<span class="pw-plan-flag">Best value</span>' : ''}
        <span class="pw-plan-name">${k === 'lifetime' ? 'Lifetime' : k[0].toUpperCase() + k.slice(1)}</span>
        <span class="pw-plan-price">${p.price}<em>${p.per}</em></span>
        <span class="pw-plan-tag">${p.tag}</span>
      </button>`;
    }).join('');
    wrap.querySelectorAll('.pw-plan').forEach(b => b.addEventListener('click', () => {
      selectedKey = b.dataset.k; renderPlans(); syncCta();
    }));
    syncCta();
  }
  function syncCta() {
    const cta = document.getElementById('pwCta'); if (!cta) return;
    cta.textContent = selectedKey === 'lifetime' ? 'Unlock Lifetime' : 'Start 7-day free trial';
  }

  // ---------- styles (self-contained) ----------
  const css = `
  .pw-overlay{position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s;}
  .pw-overlay.open{opacity:1;pointer-events:auto;}
  .pw-sheet{width:100%;max-width:440px;max-height:92%;overflow-y:auto;background:#150B24;border-top:1px solid rgba(168,85,247,.3);border-radius:20px 20px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom));position:relative;transform:translateY(14px);transition:transform .2s;font-family:'Nunito',sans-serif;color:#FAF6F0;}
  .pw-overlay.open .pw-sheet{transform:translateY(0);}
  .pw-close{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:transparent;color:#BBB0CE;font-size:18px;cursor:pointer;}
  .pw-title{font-size:20px;font-weight:800;}
  .pw-sub{font-size:12.5px;color:#BBB0CE;line-height:1.5;margin-top:4px;max-width:36ch;}
  .pw-benefits{list-style:none;margin:14px 0;padding:0;display:flex;flex-direction:column;gap:8px;}
  .pw-benefits li{position:relative;padding-left:24px;font-size:13px;color:#FAF6F0;line-height:1.4;}
  .pw-benefits li::before{content:'';position:absolute;left:2px;top:5px;width:12px;height:7px;border-left:2px solid #22C55E;border-bottom:2px solid #22C55E;transform:rotate(-45deg);}
  .pw-plans{display:flex;flex-direction:column;gap:8px;margin-bottom:14px;}
  .pw-plan{position:relative;display:flex;align-items:center;gap:8px;flex-wrap:wrap;text-align:left;width:100%;padding:12px 13px;border-radius:12px;border:1.5px solid rgba(255,255,255,.12);background:#1B1535;color:#FAF6F0;cursor:pointer;font-family:inherit;}
  .pw-plan.sel{border-color:#A855F7;background:linear-gradient(135deg,rgba(139,92,246,.18),rgba(236,72,153,.10));box-shadow:0 0 0 1px rgba(168,85,247,.35);}
  .pw-plan.hero .pw-plan-flag{position:absolute;top:-9px;left:12px;font-size:8.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#fff;background:linear-gradient(135deg,#C2410C,#9A3412);padding:2px 8px;border-radius:999px;}
  .pw-plan-name{font-size:14px;font-weight:800;}
  .pw-plan-price{margin-left:auto;font-size:15px;font-weight:800;}
  .pw-plan-price em{font-style:normal;font-size:11px;color:#BBB0CE;font-weight:600;}
  .pw-plan-tag{flex-basis:100%;font-size:10.5px;color:#A597C9;}
  .pw-plan.hero .pw-plan-tag{color:#F59E0B;}
  .pw-cta{width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#C2410C,#9A3412);color:#fff;font-family:inherit;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 4px 16px rgba(154,52,18,.4);}
  .pw-fine{font-size:10px;color:#706089;text-align:center;margin-top:9px;line-height:1.4;}
  .pw-restore{display:block;margin:8px auto 0;background:none;border:none;color:#BBB0CE;font-family:inherit;font-size:11.5px;font-weight:700;text-decoration:underline;cursor:pointer;}
  .go-pro-btn{border:1px solid rgba(245,158,11,.4);background:color-mix(in srgb,#F59E0B 14%,transparent);color:#F59E0B;font-family:inherit;font-weight:800;font-size:10.5px;padding:4px 10px;border-radius:999px;cursor:pointer;}
  .pw-toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,10px);z-index:500;background:#271F47;border:1px solid rgba(255,255,255,.15);color:#FAF6F0;font-size:12px;font-weight:700;padding:9px 15px;border-radius:999px;opacity:0;transition:all .25s;font-family:'Nunito',sans-serif;}
  .pw-toast.show{opacity:1;transform:translate(-50%,0);}
  `;
  function injectCss() { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }

  // ---------- boot ----------
  async function boot() {
    injectCss();
    // Seed the cached entitlement from storage (source of truth on cold start).
    try { const s = await readStore(); _isPro = !!s.isPremium; } catch {}
    updateProUI(_isPro);
    const go = document.getElementById('goProBtn');
    if (go) go.addEventListener('click', () => openPaywall('header'));
    init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // ---------- public API (for funnel touchpoints + feature gates) ----------
  window.Billing = {
    LIMITS,
    isPro: isProNow,
    openPaywall,
    closePaywall,
    restore,
    // Call before a Pro-only action; returns true if allowed, else opens paywall.
    requirePro(trigger) { if (isProNow()) return true; openPaywall(trigger); return false; }
  };
})();
