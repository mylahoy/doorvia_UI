/*
  DoorVia live data: reads authenticated Firebase door events and updates activities4.html.
  Add this line at the bottom of activities4.html, after the chat.js script tag:
    <script type="module" src="doorvia-live.js"></script>
*/
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, get, limitToLast, orderByKey, query, ref }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const POLL_MS = 3000;
const UNLOCK_SHOW_MS = 6000;

  const metricValues = document.querySelectorAll('.metric .value');
  const accessEl = metricValues[0];
  const deniedEl = metricValues[1];
  const doorMetricEl = document.getElementById('doorMetric');
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
  const connectionStatus = document.getElementById('firebaseStatus');

  // New "Live door log" section under the existing activity list
  const logStyle = document.createElement('style');
  logStyle.textContent =
    '.status.offline { color: var(--red, #ff6b6b);' +
    '  background: rgba(255,107,107,0.12); border-color: rgba(255,107,107,0.3); }' +
    '.status.offline::before {' +
    '  background: var(--red, #ff6b6b); box-shadow: 0 0 12px rgba(255,107,107,0.9); }' +
    '.log-details { margin-top: 22px; }' +
    '.log-details summary { cursor: pointer; list-style: none; text-align: center;' +
    '  color: var(--gold); font-size: 0.9rem; letter-spacing: 0.08em; text-transform: uppercase;' +
    '  font-weight: 700; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px;' +
    '  background: rgba(255,255,255,0.035); }' +
    '.log-details summary::-webkit-details-marker { display: none; }' +
    '.log-details summary::after { content: "\\25BE"; margin-left: 8px; }' +
    '.log-details[open] summary::after { content: "\\25B4"; }' +
    '.log-details .activity-list { margin-top: 12px; max-height: 340px; overflow-y: auto; }';
  document.head.appendChild(logStyle);

  const logDetails = document.createElement('details');
  logDetails.className = 'log-details';          // closed by default
  const logSummary = document.createElement('summary');
  logSummary.textContent = 'Live door log';
  const logList = document.createElement('ul');
  logList.className = 'activity-list';
  logDetails.append(logSummary, logList);
  mainCard.appendChild(logDetails);

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

  function setConnectionStatus(state, text) {
    connectionStatus.textContent = text;
    connectionStatus.classList.toggle('offline', state === 'offline');
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

  function setLockUI(state) {
    const locked = state === 'Locked';
    const unlocked = state === 'Unlocked';
    doorStateLabel.textContent = state;
    doorMetricEl.textContent = state;
    doorStateLabel.classList.toggle('lock', locked);
    doorStateLabel.classList.toggle('unlock', !locked && state !== 'Unknown');
    unlockBtn.classList.toggle('button-active', unlocked);
    lockBtn.classList.toggle('button-active', locked);
    unlockBtn.setAttribute('aria-pressed', String(unlocked));
    lockBtn.setAttribute('aria-pressed', String(locked));
  }

  function getDoorState(events) {
    const latestStateEvent = events.find(e =>
      ['granted', 'door_opened', 'door_closed', 'ALARM'].includes(e.event));
    if (!latestStateEvent) return 'Unknown';
    if (latestStateEvent.event === 'door_closed') return 'Locked';
    if (latestStateEvent.event === 'door_opened' || latestStateEvent.event === 'ALARM') return 'Open';
    return Date.now() - latestStateEvent.ts < UNLOCK_SHOW_MS ? 'Unlocked' : 'Locked';
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

    const doorState = getDoorState(events);
    const sensorState = !lastDoor ? 'Unknown' : lastDoor.event === 'door_closed' ? 'Closed' : 'Open';
    setLockUI(doorState);

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
    logSummary.textContent = 'Live door log (' + Math.min(events.length, 15) + ')';
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
    const alerts = events
      .filter(e => ['denied', 'lockout', 'ALARM'].includes(e.event))
      .slice(0, 3);
    alerts.forEach(e => {
      const d = describe(e);
      const label = e.event === 'denied' ? 'Wrong PIN' : 'Alarm';
      alertList.appendChild(row(timeOf(e.ts) + '  ' + d[0], label, 'alert'));
    });
    if (!alerts.length) alertList.appendChild(row('No alerts', 'OK', 'access'));
    alertList.appendChild(row(
      'Door sensor - ' + sensorState.toLowerCase(),
      sensorState,
      sensorState === 'Open' ? 'alert' : sensorState === 'Closed' ? 'access' : 'info'
    ));
  }

  function showError(err) {
    setLockUI('Unknown');
    alertList.innerHTML = '';
    if (!navigator.onLine || err.code === 'NETWORK_ERROR') {
      setConnectionStatus('offline', 'Offline');
      alertList.appendChild(row('Cannot reach Firebase. Check the internet connection.', 'Offline', 'alert'));
      return;
    }
    setConnectionStatus('online', 'Online');
    if (err.code === 'PERMISSION_DENIED' || err.code === 'AUTH_REQUIRED') {
      const signedOut = err.code === 'AUTH_REQUIRED';
      alertList.appendChild(row(
        signedOut
          ? 'Sign in to load live door status.'
          : 'Firebase denied access to door events. Check Realtime Database rules for signed-in users.',
        signedOut ? 'Signed Out' : 'No Access',
        'alert'
      ));
      return;
    }
    alertList.appendChild(row('Cannot read door events (' + err.message + ')', 'Error', 'alert'));
  }

  let refreshInProgress = false;

  async function refresh() {
    if (refreshInProgress) return;
    if (!auth.currentUser) {
      showError(Object.assign(new Error('Sign in to read door events.'), { code: 'AUTH_REQUIRED' }));
      return;
    }
    refreshInProgress = true;
    try {
      const eventsQuery = query(ref(db, 'events'), orderByKey(), limitToLast(200));
      const snapshot = await get(eventsQuery);
      setConnectionStatus('online', 'Online');
      const events = Object.values(snapshot.val() || {})
        .filter(e => e && typeof e.ts === 'number')
        .sort((a, b) => b.ts - a.ts);
      render(events);
    } catch (err) {
      showError(err);
    } finally {
      refreshInProgress = false;
    }
  }

  onAuthStateChanged(auth, user => {
    if (user) refresh();
    else showError(Object.assign(new Error('Sign in to read door events.'), { code: 'AUTH_REQUIRED' }));
  });
  window.addEventListener('offline', () => {
    showError(Object.assign(new Error('Network connection is offline.'), { code: 'NETWORK_ERROR' }));
  });
  window.addEventListener('online', refresh);
  setInterval(refresh, POLL_MS);
