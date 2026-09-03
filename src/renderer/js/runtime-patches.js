(() => {
  if (window.__luminaDesktopPatched || typeof App === 'undefined' || window.Capacitor?.isNativePlatform?.()) return;
  window.__luminaDesktopPatched = true;
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Sessão: o checkbox existente passa a ser respeitado e o logout apaga a sessão persistida.
  App.auth.login = async function() {
    const username = $('#login-username')?.value.trim();
    const password = $('#login-password')?.value;
    const err = $('#login-error');
    if (err) err.textContent = '';
    if (!username || !password) { if (err) err.textContent = 'Preencha todos os campos'; return; }
    const result = await lumina.auth.login({ username, password, remember: Boolean($('#login-remember')?.checked) });
    if (result.success) await App.auth.afterLogin(result.user);
    else if (err) err.textContent = result.error || 'Erro ao entrar';
  };
  App.auth.logout = function() {
    App.showConfirm('Sair', 'Deseja sair da conta?', async () => {
      await lumina.auth.clearSession();
      App.state.user = null; App.state.notes = []; App.state.reminders = [];
      $('#main-screen')?.classList.remove('active'); $('#auth-screen')?.classList.add('active');
      if ($('#login-password')) $('#login-password').value = '';
      await App.auth.init();
    });
  };

  // Perfil: os campos que já existiam na UI agora são realmente persistidos.
  App.settings.saveProfile = async function() {
    const data = {
      userId: App.state.user.id,
      displayName: $('#prof-name')?.value.trim() || '', email: $('#prof-email')?.value.trim() || '',
      avatarColor: App.state.user?.avatar_color, bio: $('#prof-bio')?.value || '', city: $('#prof-city')?.value || '',
      state: $('#prof-state')?.value || '', birthday: $('#prof-birthday')?.value || ''
    };
    const result = await lumina.auth.updateProfile(data);
    if (result.success) {
      Object.assign(App.state.user, { display_name:data.displayName, email:data.email, bio:data.bio, city:data.city, state:data.state, birthday:data.birthday });
      if ($('#user-name')) $('#user-name').textContent = data.displayName || App.state.user.username;
      App.showToast('Perfil atualizado!', 'success');
    } else App.showToast(result.error || 'Erro ao salvar perfil', 'error');
  };

  // A chave da IA deixa de depender de persistência comum; usa safeStorage no processo principal.
  App.settings.saveApiKey = async function() {
    const input = $('#api-key-input'); const value = input?.value.trim();
    if (!value) { App.showToast('Digite uma chave de API', 'error'); return; }
    const result = await lumina.secrets.setApiKey(value);
    if (result.success) {
      input.value = ''; input.placeholder = 'Chave protegida pelo sistema';
      App.showToast('Chave protegida com segurança', 'success');
    } else App.showToast(result.error || 'Não foi possível proteger a chave', 'error');
  };

  // Leitura editorial separada da edição, sem executar HTML vindo da nota.
  const originalOpen = App.notes.openEditor.bind(App.notes);
  function ensureReader() {
    if ($('#desktop-reader')) return;
    const style = document.createElement('style');
    style.textContent = `#desktop-reader{position:fixed;inset:0;z-index:999;background:var(--bg);display:none;overflow:auto}#desktop-reader.open{display:block}#desktop-reader .dr-head{position:sticky;top:0;display:flex;justify-content:space-between;padding:14px 22px;background:var(--bg);border-bottom:1px solid var(--border)}#desktop-reader button{min-height:38px;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:9px;padding:0 14px}#desktop-reader article{max-width:820px;margin:0 auto;padding:55px 32px 90px}#desktop-reader h1{font-family:'Instrument Serif',serif;font-size:54px;font-weight:400;line-height:1;margin:0 0 22px}#desktop-reader .dr-meta{color:var(--text-3);font-size:12px;margin-bottom:34px}#desktop-reader .dr-body{white-space:pre-wrap;font-size:18px;line-height:1.8;color:var(--text)}#desktop-reader .dr-tags{display:flex;gap:6px;margin-top:32px;flex-wrap:wrap}#desktop-reader .dr-tags span{border:1px solid var(--border);border-radius:99px;padding:5px 9px;font-size:11px;color:var(--text-2)}`;
    document.head.appendChild(style);
    const reader = document.createElement('div'); reader.id = 'desktop-reader'; document.body.appendChild(reader);
  }
  App.notes.openEditor = function(type = null, noteId = null) {
    if (!noteId) return originalOpen(type, noteId);
    const note = App.state.notes.find(n => n.id === noteId); if (!note) return originalOpen(type, noteId);
    ensureReader(); const reader = $('#desktop-reader');
    reader.innerHTML = `<div class="dr-head"><button id="dr-close">Fechar</button><button id="dr-edit">Editar</button></div><article><div class="dr-meta">${note.type === 'diary' ? 'Diário' : 'Anotação'} · ${new Date(note.updated_at || note.created_at).toLocaleString('pt-BR')}</div><h1>${esc(note.title || 'Sem título')}</h1><div class="dr-body">${esc(note.content || '')}</div><div class="dr-tags">${(note.tags || []).map(t => `<span>#${esc(t)}</span>`).join('')}</div></article>`;
    reader.classList.add('open');
    $('#dr-close').onclick = () => reader.classList.remove('open');
    $('#dr-edit').onclick = () => { reader.classList.remove('open'); originalOpen(null, noteId); };
  };

  // Recuperação: não finge envio de e-mail em uma autenticação que é local.
  if (!$('#local-recovery-info')) {
    const loginButton = $('#login-form .btn-primary');
    const btn = document.createElement('button'); btn.id='local-recovery-info'; btn.type='button'; btn.className='btn-ghost btn-full'; btn.textContent='Esqueci minha senha';
    btn.onclick = () => App.showToast('Esta conta é local. Sem servidor de e-mail, a senha só pode ser alterada estando autenticado. Exporte backups regularmente.', 'info');
    loginButton?.insertAdjacentElement('afterend', btn);
  }

  // Restaura sessão apenas se o usuário marcou "Continuar conectado".
  setTimeout(async () => {
    try {
      if (App.state.user) return;
      const session = await lumina.auth.getSession();
      if (session?.success && session.user) await App.auth.afterLogin(session.user);
    } catch (e) { console.warn('[Lumina] Sessão:', e.message); }
  }, 100);
})();
