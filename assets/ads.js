/* SaveGrow Lab — cookie consent gate and AdSense loader.
   No advertising script is requested until the reader accepts advertising
   cookies. "Essential only" is offered on the same screen as "Accept all",
   nothing is pre-ticked, and the choice can be changed from any footer. */
(function () {
  'use strict';

  var CLIENT = 'ca-pub-5443646750699471';
  var ADS_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CLIENT;
  var KEY = 'sg_consent';
  var VERSION = 1;
  var MAX_AGE = 1000 * 60 * 60 * 24 * 180; /* ask again after six months */
  var adsLoaded = false;
  var banner = null;

  function readChoice() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.v !== VERSION || typeof data.ads !== 'boolean') return null;
      if (!data.ts || Date.now() - data.ts > MAX_AGE) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function saveChoice(ads) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ads: !!ads, ts: Date.now() }));
    } catch (err) {
      /* Private mode: the choice stands for this page view only. */
    }
  }

  function loadAds() {
    if (adsLoaded) return;
    adsLoaded = true;
    if (!document.getElementById('sg-adsense')) {
      var script = document.createElement('script');
      script.id = 'sg-adsense';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = ADS_SRC;
      document.head.appendChild(script);
    }
    var units = document.querySelectorAll('ins.adsbygoogle');
    if (units.length) {
      window.adsbygoogle = window.adsbygoogle || [];
      for (var i = 0; i < units.length; i++) {
        try {
          window.adsbygoogle.push({});
        } catch (err) { /* one bad unit must not block the rest */ }
      }
    }
  }

  function unloadAds() {
    var script = document.getElementById('sg-adsense');
    if (script && script.parentNode) script.parentNode.removeChild(script);
    var units = document.querySelectorAll('ins.adsbygoogle');
    for (var i = 0; i < units.length; i++) units[i].innerHTML = '';
    adsLoaded = false;
  }

  function buildBanner() {
    var el = document.createElement('section');
    el.className = 'consent';
    el.id = 'sg-consent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-labelledby', 'sg-consent-title');
    el.setAttribute('aria-describedby', 'sg-consent-body');
    el.innerHTML =
      '<div class="consent-inner">' +
        '<div class="consent-copy">' +
          '<b class="consent-title" id="sg-consent-title" tabindex="-1">Cookies and adverts</b>' +
          '<p id="sg-consent-body">We use essential storage on your device to remember your saved plan, streak and score. With your permission we also load Google AdSense, which sets cookies to measure and personalise adverts. Both choices are fine — every tool and guide works either way.</p>' +
          '<p class="consent-links"><a href="/privacy-policy.html#ads">Advertising partners</a> · <a href="/privacy-policy.html#cookies">Cookie details</a> <span class="consent-status" data-consent-status></span></p>' +
        '</div>' +
        '<div class="consent-actions">' +
          '<button type="button" class="btn primary" data-consent-accept>Accept all</button>' +
          '<button type="button" class="btn secondary" data-consent-reject>Essential only</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function showBanner() {
    if (!banner) banner = buildBanner();
    var current = readChoice();
    var status = banner.querySelector('[data-consent-status]');
    if (status) {
      status.textContent = current
        ? (current.ads ? ' · You currently accept advertising cookies.' : ' · You currently allow essential storage only.')
        : '';
    }
    document.body.classList.add('consent-open');
    banner.classList.add('show');
    var title = banner.querySelector('#sg-consent-title');
    if (title) title.focus({ preventScroll: true });
  }

  function hideBanner() {
    if (banner) banner.classList.remove('show');
    document.body.classList.remove('consent-open');
  }

  function choose(ads) {
    saveChoice(ads);
    if (ads) loadAds();
    else unloadAds();
    hideBanner();
    document.dispatchEvent(new CustomEvent('sg:consent', { detail: { ads: !!ads } }));
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest
      ? event.target.closest('[data-consent-accept],[data-consent-reject],[data-consent-open]')
      : null;
    if (!target) return;
    if (target.hasAttribute('data-consent-open')) {
      event.preventDefault();
      showBanner();
      return;
    }
    choose(target.hasAttribute('data-consent-accept'));
  });

  function init() {
    var choice = readChoice();
    if (choice) {
      if (choice.ads) loadAds();
      return;
    }
    showBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.SGConsent = { open: showBanner, choice: readChoice };
})();
