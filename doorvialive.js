/*
  DoorVia live data: reads door events from Firebase and updates activities4.html.
  Add this line at the bottom of activities4.html, after the chat.js script tag:
    <script src="doorvia-live.js"></script>
*/
(function () {
  const DB = 'https://doorvia-smartdoor-default-rtdb.asia-southeast1.firebasedatabase.app';
  const POLL_MS = 3000;          // how often to check for new events
  const UNLOCK_SHOW_MS = 6000;   // show "Unlocked" this long after a granted event

  const metricValues = document.querySelectorAll('.metric .value');
  const accessEl = metricValues[0];
  const deniedEl = metricValues[1];
  const doorMetricEl = metricValues[2];
  const mainCard = document.querySelector('.grid > .card');
  const mainList = mainCard.querySelector('.activity-list');
  const deniedLabel = mainList.children[3].firstElementChild;
  const alertList = document.querySelector('.side-panel .card:not(.door-box) .activity-list');

  const lastUserEl = document.getElementById('lastUserSummary');
  const lockTimeEl = document.getElementById('doorLockTimeLabel');
  const residentEl = document.getElementById('residentAccessList');
  const approvedEl = document.getElementById('approvedResidentsSummary');
  const doorStateLabel = document.getElementById('doorStateLabel');
  const unlockBtn = document.getElementById('unlockButton');
  const lockBtn = document.getElementById('lockButton');

  // New "Live door log" section under the existing activity list
  const logTitle = document.createElement('h2');
  logTitle.textContent = 'Live door log';
  logTitle.style.margin = '22px 0 12px';
  const logList = document.createElement('ul');
  logList.className = 'activity-list';
  mainCard.append(logTitle, logList);

  function timeOf(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function row(text, tagText, tagClass) {
    const li = document.createElement('li');
    const a = document.createElement('span');
    const b = document.createElement('span');
    a.textContent = text;
    b.textContent = tagText;
    b.className = 'tag ' + tagClass;
    li.append(a, b);
    return li;
  }

  function describe(e) {
    switch (e.event) {
      case 'granted':     return ['Access granted - ' + e.detail, 'Access', 'access'];
      case 'denied':      return ['Access denied - ' + e.detail, 'Denied', 'alert'];
      case 'lockout':     return ['Lockout - too many failed attempts', 'Alert', 'alert'];
      case 'ALARM':       return ['Forced open - door opened without authorization', 'Alarm', 'alert'];
      case 'door_opened': return ['Door opened', 'Door', 'info'];
      case 'door_closed': return ['Door closed', 'Door', 'info'];
      case 'boot':        return ['Door controller started', 'System', 'info'];
      default:            return [e.event + (e.detail ? ' - ' + e.detail : ''), 'Info', 'info'];
    }
  }

  function setLockUI(unlocked) {
    doorStateLabel.textContent = unlocked ? 'Unlocked' : 'Locked';
    doorStateLabel.classList.toggle('lock', !unlocked);
    doorStateLabel.classList.toggle('unlock', unlocked);
    unlockBtn.classList.toggle('button-active', unlocked);
    lockBtn.classList.toggle('button-active', !unlocked);
  }

  function render(events) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = events.filter(e => e.ts >= startOfDay.getTime());

    accessEl.textContent = String(today.filter(e => e.event === 'granted').length);
    deniedEl.textContent = String(today.filter(e => e.event === 'denied').length);

    const lastGrant = events.find(e => e.event === 'granted');
    const lastDeny = events.find(e => e.event === 'denied');
    const lastDoor = events.find(e => ['door_opened', 'door_closed', 'ALARM'].includes(e.event));
    const lastClosed = events.find(e => e.event === 'door_closed');

    const unlocked = !!lastGrant && (Date.now() - lastGrant.ts) < UNLOCK_SHOW_MS;
    const isOpen = !!lastDoor && lastDoor.event !== 'door_closed';

    setLockUI(unlocked);
    doorMetricEl.textContent = unlocked ? 'Unlocked' : (isOpen ? 'Open' : 'Locked');

    if (lastGrant) {
      residentEl.textContent = 'Last access granted - ' + lastGrant.detail;
      lastUserEl.textContent = 'Last user - ' + lastGrant.detail + ' at ' + timeOf(lastGrant.ts);
    }
    approvedEl.textContent = 'Access granted today - ' + accessEl.textContent;
    deniedLabel.textContent = lastDeny
      ? 'Access denied - ' + lastDeny.detail + ' at ' + timeOf(lastDeny.ts)
      : 'Access denied - none yet';
    lockTimeEl.textContent = 'Door closed at ' + (lastClosed ? timeOf(lastClosed.ts) : '--:--');

    // Live log (newest first)
    logList.innerHTML = '';
    if (!events.length) {
      logList.appendChild(row('No door events yet', '--', 'info'));
    }
    events.slice(0, 15).forEach(e => {
      const d = describe(e);
      logList.appendChild(row(timeOf(e.ts) + '  ' + d[0], d[1], d[2]));
    });

    // Alerts card
    alertList.innerHTML = '';
    const alerts = events.filter(e => e.event === 'ALARM' || e.event === 'lockout').slice(0, 3);
    alerts.forEach(e => {
      const d = describe(e);
      alertList.appendChild(row(timeOf(e.ts) + '  ' + d[0], 'Alert', 'alert'));
    });
    if (!alerts.length) alertList.appendChild(row('No alerts', 'OK', 'access'));
    alertList.appendChild(row('Door sensor - ' + (isOpen ? 'door open' : 'door closed'), isOpen ? 'Open' : 'Normal', isOpen ? 'alert' : 'access'));
  }

  function showError(err) {
    alertList.innerHTML = '';
    alertList.appendChild(row('Cannot reach the door database (' + err.message + ')', 'Offline', 'alert'));
  }

  async function refresh() {
    try {
      const url = DB + '/events.json?orderBy=' + encodeURIComponent('"$key"') + '&limitToLast=200';
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const events = Object.values(data || {})
        .filter(e => e && typeof e.ts === 'number')
        .sort((a, b) => b.ts - a.ts);
      render(events);
    } catch (err) {
      showError(err);
    }
  }

  refresh();
  setInterval(refresh, POLL_MS);
})();