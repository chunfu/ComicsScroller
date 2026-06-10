// Helper that proxies eval() to a sandboxed iframe, so MV3 extension pages
// can keep unpacking obfuscated scripts without allowing 'unsafe-eval' in
// their own CSP.

declare var chrome: any;

let iframe = null;
let ready = null;
let counter = 0;
const pending = new Map();

function ensureIframe() {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    try {
      iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.src = chrome.runtime.getURL('sandbox.html');
      iframe.addEventListener('load', () => resolve());
      iframe.addEventListener('error', e => reject(e));
      window.addEventListener('message', event => {
        const data = event.data || {};
        const handler = pending.get(data.id);
        if (!handler) return;
        pending.delete(data.id);
        if (data.ok) {
          handler.resolve(data.result);
        } else {
          handler.reject(new Error(data.error || 'sandbox eval failed'));
        }
      });
      document.body.appendChild(iframe);
    } catch (e) {
      reject(e);
    }
  });
  return ready;
}

export function evalInSandbox(kind, payload) {
  return ensureIframe().then(
    () =>
      new Promise((resolve, reject) => {
        counter += 1;
        const id = counter;
        pending.set(id, { resolve, reject });
        iframe.contentWindow.postMessage({ id, kind, payload }, '*');
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error('sandbox eval timeout'));
          }
        }, 15000);
      }),
  );
}
