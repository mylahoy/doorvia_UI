/*
  DoorVia accounts: email + password login, email verification, one main admin.
  Add to userlogin.html, admin.html and activities4.html (after the chat.js line):
    <script type="module" src="doorvia-auth.js"></script>
*/
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         sendEmailVerification, signOut, onAuthStateChanged,
         updatePassword, reauthenticateWithCredential, EmailAuthProvider }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, ref, get, set, update, remove }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { firebaseConfig, ADMIN_UID, ADMIN_USERNAME, ADMIN_LOGIN_EMAIL } from './firebase-config.js?v=8';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const page = document.body.dataset.chatPage;
const $ = id => document.getElementById(id);
// Typing the admin username (e.g. "admin") logs in with the admin's private login address
const loginId = v => (v.trim().toLowerCase() === ADMIN_USERNAME ? ADMIN_LOGIN_EMAIL : v.trim());

localStorage.removeItem('doorviaUsers');   // old browser-only accounts (incl. default admin/1234)

function msg(id, text, type) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'message ' + (type || '');
}

function friendly(e) {
  const c = (e.code || '') + ' ' + (e.message || '');
  if (c.includes('email-already-in-use')) return 'That email is already registered.';
  if (c.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (c.includes('invalid-email')) return 'Enter a valid email address.';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found'))
    return 'Email or password is incorrect.';
  if (c.includes('too-many-requests')) return 'Too many attempts. Try again later.';
  if (c.includes('network')) return 'No internet connection.';
  if (c.includes('PERMISSION_DENIED')) return 'Not allowed by the database rules.';
  return e.message || 'Something went wrong.';
}

function relabel(id, label, placeholder, type) {
  const input = $(id);
  if (!input) return;
  input.removeAttribute('maxlength');
  if (type) input.type = type;
  input.placeholder = placeholder;
  const l = document.querySelector('label[for="' + id + '"]');
  if (l) l.textContent = label;
}

function addLogout() {
  const bar = document.querySelector('.topbar-right') || document.querySelector('.topbar > div:last-child');
  if (!bar) return;
  const b = document.createElement('button');
  b.className = 'ghost';
  b.type = 'button';
  b.textContent = 'Log out';
  b.onclick = async () => { await signOut(auth); location.href = 'userlogin.html'; };
  bar.appendChild(b);
}

// ---------------- Login / sign-up page ----------------
if (page === 'login') {
  const emailField = document.createElement('div');
  emailField.className = 'field';
  emailField.innerHTML = '<label for="createEmail">Email</label>' +
    '<input id="createEmail" type="email" placeholder="name@example.com" />';
  $('createName').closest('.field').after(emailField);
  relabel('createPin', 'Password', 'At least 6 characters', 'password');
  $('createRole').closest('.field').style.display = 'none';       // residents only; one admin
  $('createPin').closest('.two-up').style.gridTemplateColumns = '1fr';
  relabel('loginName', 'Email or admin username', 'name@example.com', 'text');
  relabel('loginPin', 'Password', 'Your password', 'password');
  const old = document.querySelector('.data-box');
  if (old) old.style.display = 'none';                            // no public user list

  window.createUser = async () => {
    const name = $('createName').value.trim();
    const email = $('createEmail').value.trim();
    const pw = $('createPin').value;
    if (!name) return msg('createMessage', 'Please add the resident name.', 'error');
    if (!email) return msg('createMessage', 'Please add an email address.', 'error');
    if (pw.length < 6) return msg('createMessage', 'Password must be at least 6 characters.', 'error');
    try {
      msg('createMessage', 'Creating account...', '');
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      await set(ref(db, 'users/' + cred.user.uid),
        { name, email, role: 'resident', status: 'pending', createdAt: Date.now() });
      await sendEmailVerification(cred.user);
      await signOut(auth);
      ['createName', 'createEmail', 'createPin'].forEach(id => { $(id).value = ''; });
      msg('createMessage', 'Account created. A verification email was sent to ' + email +
        ' (check spam). Then wait for admin approval.', 'success');
    } catch (e) { msg('createMessage', friendly(e), 'error'); }
  };

  window.loginUser = async () => {
    const email = $('loginName').value.trim();
    const pw = $('loginPin').value;
    try {
      const u = (await signInWithEmailAndPassword(auth, loginId(email), pw)).user;
      if (u.uid !== ADMIN_UID) {
        if (!u.emailVerified) {
          await signOut(auth);
          return msg('loginMessage', 'Please verify your email first (check your inbox and spam).', 'error');
        }
        const snap = await get(ref(db, 'users/' + u.uid));
        if (!snap.exists() || snap.val().status !== 'approved') {
          await signOut(auth);
          return msg('loginMessage', 'Your account is waiting for admin approval.', 'error');
        }
      }
      msg('loginMessage', 'Welcome. Access approved.', 'success');
      setTimeout(() => { location.href = 'activities4.html'; }, 400);
    } catch (e) { msg('loginMessage', friendly(e), 'error'); }
  };
}

// ---------------- Admin page ----------------
if (page === 'admin') {
  relabel('adminName', 'Admin Username', 'admin', 'text');
  relabel('adminPin', 'Admin PIN', '6 or more digits', 'password');
  addLogout();
  let residents = {};

  // User management and the lists are only shown to the logged-in admin
  // "Change PIN" panel (built here so the page needs no edits)
  const pinPanel = document.createElement('section');
  pinPanel.className = 'panel';
  pinPanel.style.marginTop = '20px';
  pinPanel.innerHTML =
    '<h2>Change Admin PIN</h2>' +
    '<div class="field"><label for="curPin">Current PIN</label><input id="curPin" type="password" placeholder="Current PIN" /></div>' +
    '<div class="field"><label for="newPin">New PIN (6 or more characters)</label><input id="newPin" type="password" placeholder="New PIN" /></div>' +
    '<div class="field"><label for="newPin2">Repeat new PIN</label><input id="newPin2" type="password" placeholder="Repeat new PIN" /></div>' +
    '<button class="primary" type="button" id="changePinBtn">Change PIN</button>' +
    '<div id="pinMessage" class="message" aria-live="polite"></div>';
  $('pendingUserSelect').closest('.panel').after(pinPanel);
  const adminSections = [
    pinPanel,
    $('pendingUserSelect').closest('.panel'),
    $('approvedUserList').closest('.data-box'),
    $('userList').closest('.data-box')
  ];
  function showAdmin(show) {
    adminSections.forEach(el => { if (el) el.style.display = show ? '' : 'none'; });
  }
  showAdmin(false);

  function fill(id, entries, empty) {
    const list = $(id);
    list.innerHTML = '';
    if (!entries.length) {
      const li = document.createElement('li');
      li.textContent = empty;
      list.appendChild(li);
      return;
    }
    entries.forEach(([, u]) => {
      const li = document.createElement('li');
      const a = document.createElement('span');
      const b = document.createElement('span');
      a.textContent = u.name + ' (' + u.email + ')';
      b.textContent = u.status === 'approved' ? 'Approved' : 'Pending';
      b.className = 'role-pill role-user';
      li.append(a, b);
      list.appendChild(li);
    });
  }

  function render() {
    const entries = Object.entries(residents);
    const sel = $('pendingUserSelect');
    sel.innerHTML = '';
    if (!entries.length) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'No residents yet';
      sel.appendChild(o);
    }
    entries.forEach(([uid, u]) => {
      const o = document.createElement('option');
      o.value = uid;
      o.textContent = u.name + ' - ' + u.email + ' (' + u.status + ')';
      sel.appendChild(o);
    });
    fill('approvedUserList', entries.filter(([, u]) => u.status === 'approved'), 'No approved residents yet.');
    fill('userList', entries, 'No residents yet.');
  }

  async function loadUsers() {
    residents = (await get(ref(db, 'users'))).val() || {};
    render();
  }

  window.adminLogin = async () => {
    try {
      const u = (await signInWithEmailAndPassword(auth, loginId($('adminName').value), $('adminPin').value)).user;
      if (u.uid !== ADMIN_UID) {
        await signOut(auth);
        return msg('adminMessage', 'This account is not the admin.', 'error');
      }
      $('adminPin').value = '';
      msg('adminMessage', 'Admin panel unlocked.', 'success');
      showAdmin(true);
      await loadUsers();
    } catch (e) { msg('adminMessage', friendly(e), 'error'); }
  };

  window.confirmUser = async () => {
    const uid = $('pendingUserSelect').value;
    if (!uid || !residents[uid]) return msg('adminMessage', 'No resident is selected.', 'error');
    try {
      await update(ref(db, 'users/' + uid), { status: 'approved' });
      residents[uid].status = 'approved';
      render();
      msg('adminMessage', residents[uid].name + ' has been approved.', 'success');
    } catch (e) { msg('adminMessage', friendly(e), 'error'); }
  };

  window.deleteUser = async () => {
    const uid = $('pendingUserSelect').value;
    if (!uid || !residents[uid]) return msg('adminMessage', 'No resident is selected.', 'error');
    const name = residents[uid].name;
    if (!window.confirm('Remove ' + name + '? They will lose access.')) return;
    try {
      await remove(ref(db, 'users/' + uid));
      delete residents[uid];
      render();
      msg('adminMessage', name + ' was removed.', 'success');
    } catch (e) { msg('adminMessage', friendly(e), 'error'); }
  };

  $('changePinBtn').onclick = async () => {
    const cur = $('curPin').value, n1 = $('newPin').value, n2 = $('newPin2').value;
    const u = auth.currentUser;
    if (!u || u.uid !== ADMIN_UID) return msg('pinMessage', 'Please log in as admin first.', 'error');
    if (n1.length < 6) return msg('pinMessage', 'New PIN must be at least 6 characters.', 'error');
    if (n1 !== n2) return msg('pinMessage', 'The new PINs do not match.', 'error');
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, cur));
      await updatePassword(u, n1);
      ['curPin', 'newPin', 'newPin2'].forEach(id => { $(id).value = ''; });
      msg('pinMessage', 'PIN changed. Use the new PIN next time you log in.', 'success');
    } catch (e) { msg('pinMessage', friendly(e), 'error'); }
  };

  render();
  onAuthStateChanged(auth, u => {
    if (u && u.uid === ADMIN_UID) {
      msg('adminMessage', 'Signed in as admin.', 'success');
      showAdmin(true);
      loadUsers().catch(e => msg('adminMessage', friendly(e), 'error'));
    } else {
      showAdmin(false);
    }
  });
}

// ---------------- Activity page: only approved residents ----------------
if (page === 'activity') {
  document.body.style.visibility = 'hidden';
  addLogout();
  onAuthStateChanged(auth, async u => {
    const deny = async () => { await signOut(auth).catch(() => {}); location.replace('userlogin.html'); };
    if (!u) return location.replace('userlogin.html');
    if (u.uid !== ADMIN_UID) {
      try {
        const s = await get(ref(db, 'users/' + u.uid));
        if (!s.exists() || s.val().status !== 'approved' || !u.emailVerified) return deny();
      } catch (e) { return deny(); }
    }
    document.body.style.visibility = 'visible';
  });
}
