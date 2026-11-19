/* SaveGrow Lab — advertising consent helpers.
   The AdSense tag itself sits in the <head> of every page, which is what lets
   Google's certified consent management platform (CMP) collect and record the
   reader's choice. This file only wires up the footer control that reopens
   that choice, falling back to the policy section if no CMP is configured. */
(function () {
  'use strict';

  function openGoogleMessage() {
    var gfc = window.googlefc;
    if (gfc) {
      gfc.callbackQueue = gfc.callbackQueue || [];
      if (typeof gfc.showRevocationMessage === 'function') {
        gfc.callbackQueue.push(gfc.showRevocationMessage);
        return true;
      }
      if (typeof gfc.showConsentMessage === 'function') {
        gfc.callbackQueue.push(gfc.showConsentMessage);
        return true;
      }
    }
    if (typeof window.__tcfapi === 'function') {
      window.__tcfapi('displayConsentUi', 2, function () {});
      return true;
    }
    return false;
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest
      ? event.target.closest('[data-consent-open]')
      : null;
    if (!target) return;
    if (openGoogleMessage()) {
      event.preventDefault();
      return;
    }
    location.href = '/privacy-policy.html#cookies';
  });
})();
