/*
  DoorVia status chip.
    Green  = this device has internet AND the door unit sent a heartbeat recently
    Red    = "Offline" (no internet) or "Door Offline" (no heartbeat from the ESP32)
  Add to userlogin.html and activities4.html, after the chat.js script tag:
    <script src="doorvia-status.js"></script>
*/
(function () {
  const DB = 'https://doorvia-smartdoor-default-rtdb.asia-southeast1.firebasedatabase.app';
  const CHECK_MS = 5000;
  const STALE_MS = 90000;   // door unit is "offline" if no heartbeat for 90 seconds

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

  function show(online, text) {
    chip.classList.toggle('offline', !online);
    chip.textContent = text;
  }

  async function check() {
    if (!navigator.onLine) { show(false, 'Offline'); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(DB + '/status.json', { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const fresh = data && typeof data.ts === 'number' && (Date.now() - data.ts) < STALE_MS;
      if (fresh) show(true, onlineText);
      else show(false, 'Door Offline');
    } catch (e) {
      show(false, 'Offline');
    } finally {
      clearTimeout(timer);
    }
  }

  window.addEventListener('online', check);
  window.addEventListener('offline', () => show(false, 'Offline'));
  check();
  setInterval(check, CHECK_MS);
})();
