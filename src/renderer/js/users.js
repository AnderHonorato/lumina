// Lumina users + platform bootstrap. Carregado depois de app.js.
(function bootstrapLuminaPlatform() {
  const isNative = Boolean(window.Capacitor?.isNativePlatform?.());
  if (!isNative || window.lumina) return;

  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  window.__luminaMobileResolve = resolveReady;
  window.__luminaMobileReject = rejectReady;

  const call = (grupo, metodo) => (...args) => ready.then(api => {
    if (!api?.[grupo]?.[metodo]) throw new Error(`Recurso móvel indisponível: ${grupo}.${metodo}`);
    return api[grupo][metodo](...args);
  });
  const ns = (grupo, metodos) => Object.fromEntries(metodos.map(m => [m, call(grupo, m)]));

  window.lumina = {
    platform: { kind: 'android', isNative: true, ready: () => ready },
    window: ns('window', ['minimize','maximize','close','hideToTray','quit']),
    auth: ns('auth', ['register','login','getUsers','updateProfile','changePassword','updateAvatar','getSession','clearSession']),
    notes: ns('notes', ['getAll','getOne','create','update','delete','deleteMultiple','getHistory','search','getTags','restore','purge','getVersions','restoreVersion']),
    reminders: ns('reminders', ['getAll','create','update','delete','complete']),
    calendar: ns('calendar', ['getEvents','create','update','delete']),
    demands: ns('demands', ['getAll','getOne','create','update','delete']),
    chat: ns('chat', ['getConversations','getConversation','createConversation','deleteConversation','updateConversation','addMessage','getHistory']),
    users: ns('users', ['sendMessage','getMessages','getConversations','deleteMessage','blockUser','archiveChat','shareItem','getSharedItems']),
    files: ns('files', ['save','getPath','delete','open','readAsBase64']),
    dialog: ns('dialog', ['openFile','saveFile']),
    data: ns('data', ['export','import','importPayload']),
    settings: ns('settings', ['get','save']),
    ai: ns('ai', ['refine','chat']),
    alarms: ns('alarms', ['getAll','create','update','delete']),
    secrets: ns('secrets', ['setApiKey','getApiKey','removeApiKey']),
    native: ns('native', ['shareNote','location','haptic']),
    search: ns('search', ['global']),
    network: ns('network', ['start','getPeers','sendToPeer']),
    reminder: {
      openNote: (...args) => ready.then(api => api.reminder.openNote(...args)),
      dismiss: (...args) => ready.then(api => api.reminder.dismiss(...args))
    },
    on: (channel, callback) => { ready.then(api => api.on(channel, callback)); },
    off: (channel, callback) => { ready.then(api => api.off(channel, callback)); }
  };

  document.documentElement.classList.add('lumina-native', 'lumina-android');
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = 'styles/mobile.css'; document.head.appendChild(css);
  const stableCss = document.createElement('link');
  stableCss.rel = 'stylesheet'; stableCss.href = 'styles/mobile-stability.css'; document.head.appendChild(stableCss);

  let uiLoaded = false;
  const loadMobileUI = () => {
    if (uiLoaded) return;
    uiLoaded = true;
    const ui = document.createElement('script');
    ui.src = 'js/mobile-ui.js';
    ui.onload = () => {
      const parity = document.createElement('script');
      parity.src = 'js/mobile-parity.js';
      parity.onerror = () => window.__luminaBootFail?.(new Error('Não foi possível carregar a paridade funcional Android'), 'Recursos Android');
      document.head.appendChild(parity);
    };
    ui.onerror = () => window.__luminaBootFail?.(new Error('Não foi possível carregar a interface móvel'), 'Interface móvel');
    document.head.appendChild(ui);
  };
  window.addEventListener('lumina:mobile-ready', loadMobileUI, { once: true });

  const platform = document.createElement('script');
  platform.src = 'js/mobile-platform-v2.js';
  platform.onerror = () => {
    const error = new Error('Não foi possível carregar o adaptador Android v2');
    window.__luminaBootFail?.(error, 'Adaptador Android');
    rejectReady(error);
  };
  document.head.appendChild(platform);
})();

(function attachUsersModule() {
  if (typeof App === 'undefined') { setTimeout(attachUsersModule, 50); return; }

  App.ui.switchAuthTab = function(tab) {
    const target = tab === 'register' ? 'register' : 'login';
    const isLogin = target === 'login';

    document.querySelectorAll('.auth-tab').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === target);
      button.setAttribute('aria-selected', button.dataset.tab === target ? 'true' : 'false');
    });

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    loginForm?.classList.toggle('active', isLogin);
    registerForm?.classList.toggle('active', !isLogin);

    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    if (loginError) loginError.textContent = '';
    if (registerError) registerError.textContent = '';

    requestAnimationFrame(() => {
      const firstField = document.querySelector(isLogin ? '#login-form input' : '#register-form input');
      firstField?.focus({ preventScroll: true });
    });
  };

  const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pinIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-5.33 7-12a7 7 0 1 0-14 0c0 6.67 7 12 7 12z"/><circle cx="12" cy="9" r="2"/></svg>';
  const fileIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>';

  App.users = {
    otherUserId: null,
    otherUser: null,
    render() {
      const list = document.getElementById('users-list');
      const empty = document.getElementById('users-empty');
      if (!list || !empty) return;
      const all = App.state.allUsers || [];
      const others = all.filter(u => u.id !== App.state.user?.id);
      if (others.length === 0) { empty.style.display = 'flex'; list.innerHTML = ''; return; }
      empty.style.display = 'none';
      list.innerHTML = others.map(u => {
        const hasPhoto = Boolean(u.avatar_photo);
        const avatarStyle = hasPhoto ? `background-image:url('${esc(u.avatar_photo)}');background-size:cover` : `background:${u.avatar_color || 'var(--accent)'}`;
        return `<button type="button" class="user-card" onclick="App.users.openChat('${esc(u.id)}')">
          <div class="user-card-avatar" style="${avatarStyle}">${hasPhoto ? '' : esc((u.display_name || u.username || 'U')[0].toUpperCase())}</div>
          <div class="user-card-info"><span class="user-card-name">${esc(u.display_name || u.username)}</span><span class="user-card-handle">@${esc(u.username)}</span>
          ${u.bio ? `<span class="user-card-bio">${esc(u.bio)}</span>` : ''}
          ${u.city ? `<span class="user-card-loc">${pinIcon} ${esc(u.city)}${u.state ? '/' + esc(u.state) : ''}</span>` : ''}</div></button>`;
      }).join('');
    },
    async openChat(userId) {
      this.otherUserId = userId;
      const all = App.state.allUsers || [];
      this.otherUser = all.find(u => u.id === userId);
      const name = document.getElementById('user-chat-name');
      if (name) name.textContent = this.otherUser?.display_name || this.otherUser?.username || 'Usuário';
      const avatar = document.getElementById('user-chat-avatar');
      if (avatar) {
        const hasPhoto = this.otherUser?.avatar_photo;
        avatar.style.cssText = hasPhoto ? `background-image:url('${this.otherUser.avatar_photo}');background-size:cover` : `background:${this.otherUser?.avatar_color || 'var(--accent)'}`;
        avatar.textContent = hasPhoto ? '' : ((this.otherUser?.display_name || 'U')[0].toUpperCase());
      }
      await this.loadMessages();
      const modal = document.getElementById('user-chat-modal');
      if (modal) { modal.style.display = 'flex'; setTimeout(() => modal.classList.add('open'), 10); }
    },
    async loadMessages() {
      if (!this.otherUserId) return;
      const msgs = await lumina.users.getMessages(App.state.user.id, this.otherUserId);
      const container = document.getElementById('user-chat-messages');
      if (!container) return;
      if (!msgs?.length) { container.innerHTML = '<p class="mobile-empty-copy">Nenhuma mensagem ainda</p>'; return; }
      container.innerHTML = msgs.map(m => {
        const isMe = m.from_user_id === App.state.user.id;
        const time = new Date(m.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
        let content = '';
        if (m.file_data) {
          const safeData = esc(m.file_data);
          if (m.file_type?.startsWith('image/')) content = `<img src="${safeData}" class="chat-media" alt="${esc(m.file_name || 'Imagem')}">`;
          else if (m.file_type?.startsWith('video/')) content = `<video src="${safeData}" controls class="chat-media"></video>`;
          else if (m.file_type?.startsWith('audio/')) content = `<audio src="${safeData}" controls></audio>`;
          else content = `<div class="chat-file">${fileIcon}<span>${esc(m.file_name || 'Arquivo')}</span></div>`;
        }
        if (m.content) content += `<span>${esc(m.content)}</span>`;
        return `<div class="chat-msg ${isMe ? 'user' : 'assistant'}"><div class="chat-msg-content"><div class="chat-msg-text">${content}</div><div class="chat-msg-time">${time}</div></div></div>`;
      }).join('');
      container.scrollTop = container.scrollHeight;
    },
    async sendMessage() {
      const input = document.getElementById('user-chat-input');
      const text = input?.value.trim(); if (!text) return;
      input.value = ''; input.style.height = 'auto';
      await lumina.users.sendMessage({ fromUserId: App.state.user.id, toUserId: this.otherUserId, content: text });
      await this.loadMessages();
    },
    async handleFile(event) {
      const file = event.target.files?.[0]; if (!file) return;
      if (file.size > 10 * 1024 * 1024) { App.showToast('Arquivo muito grande (máx. 10 MB)', 'error'); return; }
      const reader = new FileReader();
      reader.onload = async e => {
        await lumina.users.sendMessage({ fromUserId: App.state.user.id, toUserId: this.otherUserId, content:'', fileName:file.name, fileData:e.target.result, fileType:file.type });
        await this.loadMessages();
      };
      reader.readAsDataURL(file); event.target.value = '';
    },
    blockChat() { App.showConfirm('Bloquear', 'Bloquear este usuário?', async () => { await lumina.users.blockUser({ userId: App.state.user.id, blockUserId: this.otherUserId }); App.ui.closeModal('user-chat-modal'); App.showToast('Usuário bloqueado', 'info'); }); },
    async archiveChat() { await lumina.users.archiveChat({ userId: App.state.user.id, otherUserId: this.otherUserId }); App.ui.closeModal('user-chat-modal'); App.showToast('Chat arquivado', 'info'); },
    async shareNote() {
      const note = App.state.notes?.[0]; if (!note) { App.showToast('Nenhuma nota para compartilhar', 'error'); return; }
      if (window.Capacitor?.isNativePlatform?.() && lumina.native?.shareNote) await lumina.native.shareNote(note);
      else await lumina.users.shareItem({ fromUserId: App.state.user.id, toUserId: this.otherUserId, itemType:'note', itemData:JSON.stringify(note) });
      App.showToast('Nota compartilhada!', 'success');
    }
  };

  const origNavigate = App.ui.navigate;
  App.ui.navigate = function(page) { origNavigate(page); if (page === 'users') App.users.render(); };
  console.log('[Lumina] Users module loaded');
})();