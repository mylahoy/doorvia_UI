(() => {
  const widget = document.createElement('aside');
  widget.className = 'help-chat';
  widget.innerHTML = `
    <section class="help-chat-panel" hidden aria-label="Help chat">
      <header class="help-chat-header">
        <div>
          <strong>Help chat</strong>
          <small>Door access support</small>
        </div>
        <button class="help-chat-close" type="button" aria-label="Close help chat">&times;</button>
      </header>
      <div class="help-chat-messages" aria-live="polite">
        <div class="help-chat-message">Hi. I can help with login, resident approval, or door controls.</div>
      </div>
      <form class="help-chat-form">
        <input class="help-chat-input" type="text" placeholder="Ask for help..." aria-label="Ask for help" autocomplete="off" />
        <button class="help-chat-send" type="submit">Send</button>
      </form>
    </section>
    <button class="help-chat-toggle" type="button" aria-expanded="false">Help</button>
  `;
  document.body.appendChild(widget);

  const panel = widget.querySelector('.help-chat-panel');
  const toggle = widget.querySelector('.help-chat-toggle');
  const close = widget.querySelector('.help-chat-close');
  const form = widget.querySelector('.help-chat-form');
  const input = widget.querySelector('.help-chat-input');
  const messages = widget.querySelector('.help-chat-messages');

  const replies = [
    { matches: ['login', 'pin'], text: 'Use your registered name and 4-digit PIN. Pending residents must be approved by an admin.' },
    { matches: ['approve', 'resident', 'admin'], text: 'Open the Admin Panel, unlock it, select a resident, and choose Confirm User.' },
    { matches: ['delete', 'remove'], text: 'In the Admin Panel, select a resident and choose Delete User. A confirmation will appear.' },
    { matches: ['door', 'unlock', 'lock'], text: 'After logging in, use the door controls to open, close, or force-open the door.' }
  ];

  function addMessage(text, type) {
    const message = document.createElement('div');
    message.className = `help-chat-message${type ? ` ${type}` : ''}`;
    message.textContent = text;
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
  }

  function respond(text) {
    const normalized = text.toLowerCase();
    const match = replies.find(reply => reply.matches.some(keyword => normalized.includes(keyword)));
    addMessage(match ? match.text : 'Try asking about login, resident approval, deleting a user, or door controls.');
  }

  function setOpen(isOpen) {
    panel.hidden = !isOpen;
    toggle.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) input.focus();
  }

  toggle.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addMessage(text, 'user');
    input.value = '';
    respond(text);
  });
})();
