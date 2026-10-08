/*
  DoorVia accounts: email + password login, email verification, one main admin.
  Add to userlogin.html, admin.html and activities4.html (after the chat.js line):
    <script type="module" src="doorvia-auth.js"></script>
*/
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         sendEmailVerification, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, ref, get, set, update, remove, query, orderByChild, equalTo, limitToFirst }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { firebaseConfig, ADMIN_UID, ADMIN_USERNAME, ADMIN_LOGIN_EMAIL } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const page = document.body.dataset.chatPage;
const $ = id => document.getElementById(id);

try {
  localStorage.removeItem('doorviaUsers');
} catch (error) {
  console.error('Unable to clear legacy browser-only accounts:', error);
}

function msg(id, text, type) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'message ' + (type || '');
}

function friendly(e) {
  if (e.code === 'USERNAME_NOT_FOUND') return 'Username not found. Check the spelling or use your email.';
  if (e.code === 'USERNAME_AMBIGUOUS') return 'That name matches more than one account. Please log in with your email.';
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

async function resolveLoginEmail(identifier) {
  const value = identifier.trim();
  if (value.includes('@')) return value;

  if (value.toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
    return ADMIN_LOGIN_EMAIL;
  }

  const normalized = value.toLowerCase();
  const usernameResults = await get(query(
    ref(db, 'users'),
    orderByChild('username'),
    equalTo(normalized),
    limitToFirst(2)
  ));
  let matches = Object.entries(usernameResults.val() || {});

  if (!matches.length) {
    const legacyNameResults = await get(query(
      ref(db, 'users'),
      orderByChild('name'),
      equalTo(value),
      limitToFirst(2)
    ));
    matches = Object.entries(legacyNameResults.val() || {});
  }

  if (!matches.length) {
    throw Object.assign(new Error('No account matches that username.'), { code: 'USERNAME_NOT_FOUND' });
  }
  if (matches.length > 1) {
    throw Object.assign(new Error('More than one account matches that name.'), { code: 'USERNAME_AMBIGUOUS' });
  }

  const email = matches[0][1].email;
  if (!email) {
    throw new Error('This account has no email address. Please contact the admin.');
  }
  return email;
}

async function signOutSafely() {
  try {
    await signOut(auth);
    return true;
  } catch (error) {
    console.error('Unable to clear the Firebase session:', error);
    return false;
  }
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
  b.onclick = async () => {
    if (await signOutSafely()) {
      location.href = 'userlogin.html';
    } else {
      window.alert('Could not sign out. Please try again.');
    }
  };
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
  relabel('loginName', 'Email or username', 'Email or resident name', 'text');
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
    let accountCreated = false;
    let profileSaved = false;
    try {
      msg('createMessage', 'Creating account...', '');
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      accountCreated = true;
      await set(ref(db, 'users/' + cred.user.uid),
        { name, username: name.toLowerCase(), email, role: 'resident', status: 'pending', createdAt: Date.now() });
      profileSaved = true;
      await sendEmailVerification(cred.user);
      if (!(await signOutSafely())) {
        return msg('createMessage',
          'Account created, but sign-out failed. Please try logging out before continuing.',
          'error');
      }
      ['createName', 'createEmail', 'createPin'].forEach(id => { $(id).value = ''; });
      msg('createMessage', 'Account created. A verification email was sent to ' + email +
        ' (check spam). Then wait for admin approval.', 'success');
    } catch (e) {
      if (accountCreated) {
        const sessionCleared = await signOutSafely();
        if (!profileSaved) {
          console.error('Firebase account was created but its resident profile could not be saved:', e);
          return msg('createMessage',
            'The account was created, but setup could not finish. Contact the admin before trying to register again.' +
              (sessionCleared ? '' : ' Sign out could not be confirmed; close this tab after noting this issue.'),
            'error');
        }
        if (!sessionCleared) {
          return msg('createMessage',
            friendly(e) + ' Sign out could not be confirmed; close this tab after noting this issue.',
            'error');
        }
      }
      msg('createMessage', friendly(e), 'error');
    }
  };

  window.loginUser = async () => {
    const identifier = $('loginName').value.trim();
    const pw = $('loginPin').value;
    if (!identifier) return msg('loginMessage', 'Enter your email or username.', 'error');
    if (!pw) return msg('loginMessage', 'Enter your password.', 'error');
    let authenticated = false;
    try {
      const email = await resolveLoginEmail(identifier);
      const u = (await signInWithEmailAndPassword(auth, email, pw)).user;
      authenticated = true;
      if (u.uid !== ADMIN_UID) {
        if (!u.emailVerified) {
          const sessionCleared = await signOutSafely();
          return msg('loginMessage',
            'Please verify your email first (check your inbox and spam).' +
              (sessionCleared ? '' : ' Sign out failed; close this tab before continuing.'),
            'error');
        }
        const snap = await get(ref(db, 'users/' + u.uid));
        if (!snap.exists() || snap.val().status !== 'approved') {
          const sessionCleared = await signOutSafely();
          return msg('loginMessage',
            'Your account is waiting for admin approval.' +
              (sessionCleared ? '' : ' Sign out failed; close this tab before continuing.'),
            'error');
        }
      }
      msg('loginMessage', 'Welcome. Access approved.', 'success');
      setTimeout(() => { location.href = 'activities4.html'; }, 400);
    } catch (e) {
      const sessionCleared = authenticated ? await signOutSafely() : true;
      msg('loginMessage',
        friendly(e) + (sessionCleared ? '' : ' Sign out failed; close this tab before continuing.'),
        'error');
    }
  };
}

// ---------------- Admin page ----------------
if (page === 'admin') {
  relabel('adminName', 'Admin Email or username', 'Email or admin username', 'text');
  relabel('adminPin', 'Admin Password', 'Password', 'password');
  addLogout();
  let residents = {};
  const adminOnlyContent = document.querySelectorAll('[data-admin-only]');
  const setAdminContentVisible = visible => {
    adminOnlyContent.forEach(el => { el.hidden = !visible; });
  };
  setAdminContentVisible(false);

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
      const email = await resolveLoginEmail($('adminName').value);
      const u = (await signInWithEmailAndPassword(auth, email, $('adminPin').value)).user;
      if (u.uid !== ADMIN_UID) {
        const sessionCleared = await signOutSafely();
        return msg('adminMessage',
          'This account is not the admin.' +
            (sessionCleared ? '' : ' Sign out failed; close this tab before continuing.'),
          'error');
      }
      $('adminPin').value = '';
      await loadUsers();
      setAdminContentVisible(true);
      msg('adminMessage', 'Admin panel unlocked.', 'success');
    } catch (e) { msg('adminMessage', friendly(e), 'error'); }
  };

  window.confirmUser = async () => {
    const uid = $('pendingUserSelect').value;
    if (!uid || !residents[uid]) return msg('adminMessage', 'No resident is selected.', 'error');
    if (residents[uid].status === 'approved')
      return msg('adminMessage', residents[uid].name + ' is already approved.', 'error');
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

  render();
  onAuthStateChanged(auth, async u => {
    if (u && u.uid === ADMIN_UID) {
      try {
        await loadUsers();
        setAdminContentVisible(true);
        msg('adminMessage', 'Signed in as admin.', 'success');
      } catch (e) {
        residents = {};
        render();
        setAdminContentVisible(false);
        msg('adminMessage', friendly(e), 'error');
      }
    } else {
      residents = {};
      render();
      setAdminContentVisible(false);
    }
  });
}

// ---------------- Activity page: only approved residents ----------------
if (page === 'activity') {
  document.body.style.visibility = 'hidden';
  addLogout();
  onAuthStateChanged(auth, async u => {
    const deny = async () => { await signOutSafely(); location.replace('userlogin.html'); };
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
