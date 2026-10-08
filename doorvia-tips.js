/*
  DoorVia tips: a "Tips" button with common questions and short answers.
  Hides the old help chat bubble. Add to userlogin.html, admin.html and activities4.html:
    <script src="doorvia-tips.js"></script>
*/
(function () {
  const TIPS = {
    login: [
      ['How do I create an account?',
       'Enter your name, your email and a password of 6 to 10 characters, then click Create User. A verification email is sent to you.'],
      ['I did not get the verification email.',
       'Check your spam or junk folder. It comes from a noreply address and can take a few minutes. If it never arrives, ask the admin to remove your account so you can sign up again.'],
      ['It says my account is waiting for approval.',
       'Only the main admin can approve residents. Once approved, log in again and you will get in.'],
      ['I forgot my password.',
       'Ask the admin to remove your account, then sign up again with a new password.'],
      ['Can I log in from my phone?',
       'Yes. Use the same email and password on any device.']
    ],
    admin: [
      ['How do I approve a resident?',
       'Log in with the admin email, pick the resident in the list and click Confirm User. They must also have verified their email.'],
      ['How do I remove a resident?',
       'Pick them and click Delete User. They lose access immediately. To let the same email sign up again, also delete it in Firebase under Authentication > Users.'],
      ['Can I add a second admin?',
       'No. DoorVia is set up with one main admin, and everyone else is a resident.'],
      ['A new resident is not in the list.',
       'Residents appear after they create their account. Reload the page and log in again as admin.']
    ],
    activity: [
      ['What do the tags in the log mean?',
       'Access means a card or PIN opened the door. Denied means a wrong card or PIN. Alarm means the door opened without a valid card or PIN.'],
      ['Why does the status say Door Offline?',
       'The door unit has not reported in for about 90 seconds. Check that it has power and WiFi.'],
      ['Why is Access Today 0?',
       'It only counts events from today, and resets at midnight.'],
      ['Do the Lock and Unlock buttons open the real door?',
       'Not yet. They only change what this page shows. Use the keypad or an RFID card at the door.'],
      ['What happens after wrong attempts?',
       'Three wrong tries in a row lock the keypad and reader for 30 seconds.'],
      ['How long does the door stay unlocked?',
       'About 5 seconds, or until the door is closed. If it stays open for 30 seconds, the door beeps as a reminder.'],
      ['How do I log out?',
       'Use the Log out button at the top right of the page.']
    ]
  };

  const items = TIPS[document.body.dataset.chatPage];
  if (!items) return;

  const css = document.createElement('style');
  css.textContent =
    '.help-chat { display: none !important; }' +
    '.tips { position: fixed; right: 22px; bottom: 22px; z-index: 1000; font-family: "Segoe UI", Arial, sans-serif; text-align: left; }' +
    '.tips-toggle { border: 0; border-radius: 999px; padding: 12px 18px; background: #ff9f5a; color: #20150f;' +
    '  box-shadow: 0 12px 28px rgba(0,0,0,0.3); cursor: pointer; font-weight: 700; font: inherit; font-weight: 700; }' +
    '.tips-panel { width: min(340px, calc(100vw - 36px)); max-height: min(70vh, 480px); overflow-y: auto; margin-bottom: 10px;' +
    '  border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; background: #101d2d; color: #edf3ff;' +
    '  box-shadow: 0 18px 44px rgba(0,0,0,0.38); }' +
    '.tips-panel[hidden] { display: none; }' +
    '.tips-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #172b3d; }' +
    '.tips-head strong { display: block; }' +
    '.tips-head small { display: block; margin-top: 3px; color: #a3b9ce; }' +
    '.tips-close { border: 0; background: transparent; color: #edf3ff; cursor: pointer; font-size: 1.2rem; }' +
    '.tips-list { padding: 8px 12px 14px; }' +
    '.tips-list details { border-bottom: 1px solid rgba(255,255,255,0.08); padding: 10px 4px; }' +
    '.tips-list summary { cursor: pointer; font-weight: 600; font-size: 0.92rem; color: #f8d38a; }' +
    '.tips-list p { margin: 8px 0 2px; font-size: 0.88rem; line-height: 1.5; color: #dfeaff; }';
  document.head.appendChild(css);

  const root = document.createElement('div');
  root.className = 'tips';

  const panel = document.createElement('div');
  panel.className = 'tips-panel';
  panel.hidden = true;

  const head = document.createElement('div');
  head.className = 'tips-head';
  const title = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = 'Tips';
  const small = document.createElement('small');
  small.textContent = 'Common questions';
  title.append(strong, small);
  const close = document.createElement('button');
  close.className = 'tips-close';
  close.type = 'button';
  close.textContent = '\u00D7';
  close.setAttribute('aria-label', 'Close tips');
  head.append(title, close);

  const list = document.createElement('div');
  list.className = 'tips-list';
  items.forEach(function (qa) {
    const d = document.createElement('details');
    const s = document.createElement('summary');
    const p = document.createElement('p');
    s.textContent = qa[0];
    p.textContent = qa[1];
    d.append(s, p);
    list.appendChild(d);
  });

  panel.append(head, list);

  const toggle = document.createElement('button');
  toggle.className = 'tips-toggle';
  toggle.type = 'button';
  toggle.textContent = 'Tips';
  toggle.setAttribute('aria-expanded', 'false');

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  }
  toggle.addEventListener('click', function () { setOpen(panel.hidden); });
  close.addEventListener('click', function () { setOpen(false); });

  root.append(panel, toggle);
  document.body.appendChild(root);
})();
