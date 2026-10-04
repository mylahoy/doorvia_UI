/*
  DoorVia status chip: shows "Offline" (red) when there is no internet,
  and the normal green label when online.
  Add to userlogin.html and activities4.html, after the chat.js script tag:
    <script src="doorvia-status.js"></script>
*/
(function () {
  const DB = 'https://doorvia-smartdoor-default-rtdb.asia-southeast1.firebasedatabase.app';
  const CHECK_MS = 10000;

  const chip = document.querySelector('.status-chip, .status');
  if (!chip) return;
  const onlineText = chip.textContent.trim() || 'System Online';

  const style = document.createElement('style');
  style.textContent =
    '.status-chip.offline, .status.offline {' +
    '  color: var(--red, #ff6b6b); background: rgba(255,107,107,0.12);' +
    '  border-color: rgba(255,107,107,0.3); }' +
    '.status-chip.offline::before, .status.offline::before {' +
    '  background: var(--red, #ff6b6b); box-shadow: 0 0 12px rgba(255,107,107,0.9); }';
  document.head.appendChild(style);

  function setOnline(online) {
    chip.classList.toggle('offline', !online);
    chip.textContent = online ? onlineText : 'Offline';
  }

  // Any HTTP reply from the database (even "permission denied") means the internet works.
  async function check() {
    if (!navigator.onLine) { setOnline(false); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
      await fetch(DB + '/.json?shallow=true', { signal: ctrl.signal, cache: 'no-store' });
      setOnline(true);
    } catch (e) {
      setOnline(false);
    } finally {
      clearTimeout(timer);
    }
  }

  window.addEventListener('online', check);
  window.addEventListener('offline', () => setOnline(false));
  check();
  setInterval(check, CHECK_MS);
})();