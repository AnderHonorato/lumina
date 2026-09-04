/* Lumina Notes — paridade funcional Android.
   Reexpõe no mobile os recursos que ficam escondidos quando a sidebar desktop some. */
(() => {
  'use strict';
  if (!window.Capacitor?.isNativePlatform?.()) return;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => { try { return new Date(value).toLocaleString('pt-BR'); } catch { return ''; } };
  const svg = path => `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const icons = {
    more: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
    bell: svg('<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>'),
    brief: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18"/>'),
    history: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M4 4v5h5"/>'),
    users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>'),
    ai: svg('<path d="M12 3l1.8 4.7L19 9.5l-4.3 2.8L16 18l-4-3-4 3 1.3-5.7L5 9.5l5.2-1.8z"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
    alarm: svg('<circle cx="12" cy="13" r="7"/><path d="M12 9v4l3 2M5 3 2 6M19 3l3 3"/>'),
    trash: svg('<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"/>'),
    backup: svg('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 20h14"/>'),
    close: svg('<path d="m6 6 12 12M18 6 6 18"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    send: svg('<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>')
  };

  let initialized = false;
  let currentDemandId = null;
  let currentConversationId = null;

  function waitForApp() {
    if (initialized) return;
    if (typeof App === 'undefined' || !window.lumina || !$('#mobile-bottom-nav')) {
      setTimeout(waitForApp, 80);
      return;
    }
    initialized = true;
    installShell();
    installDemands();
    installHistory();
    installChat();
    patchNavigation();
    console.log('[Lumina] Paridade Android carregada');
  }

  function installShell() {
    const oldProfile = $('#mobile-profile');
    if (oldProfile && !$('#mobile-more')) {
      const more = oldProfile.cloneNode(false);
      more.id = 'mobile-more';
      more.type = 'button';
      more.innerHTML = `${icons.more}<span>Mais</span>`;
      oldProfile.replaceWith(more);
      more.addEventListener('click', openMore);
    }

    if (!$('#mobile-parity-sheet')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="mobile-parity-sheet" class="mobile-parity-sheet" hidden>
          <div class="mobile-parity-card" role="dialog" aria-modal="true" aria-label="Mais recursos">
            <div class="mobile-parity-head"><div><strong>Todos os recursos</strong><small>Lumina Notes</small></div><button id="mobile-parity-close" type="button" aria-label="Fechar">${icons.close}</button></div>
            <div class="mobile-parity-grid">
              <button data-parity="reminders">${icons.bell}<span>Lembretes</span></button>
              <button data-parity="demands">${icons.brief}<span>Demandas</span></button>
              <button data-parity="history">${icons.history}<span>Histórico</span></button>
              <button data-parity="users">${icons.users}<span>Usuários</span></button>
              <button data-parity="chat">${icons.ai}<span>IA</span></button>
              <button data-parity="search">${icons.search}<span>Busca</span></button>
              <button data-parity="alarms">${icons.alarm}<span>Alarmes</span></button>
              <button data-parity="trash">${icons.trash}<span>Lixeira</span></button>
              <button data-parity="settings">${icons.settings}<span>Configurações</span></button>
              <button data-parity="backup">${icons.backup}<span>Backup</span></button>
            </div>
          </div>
        </div>
        <div id="mobile-parity-overlay" class="mobile-parity-overlay" hidden></div>
      `);
      $('#mobile-parity-close').onclick = closeMore;
      $('#mobile-parity-sheet').addEventListener('click', e => { if (e.target === e.currentTarget) closeMore(); });
      $$('[data-parity]').forEach(button => button.onclick = () => launch(button.dataset.parity));
    }
  }

  function openMore() {
    const sheet = $('#mobile-parity-sheet');
    sheet.hidden = false;
    document.body.classList.add('mobile-parity-open');
  }
  function closeMore() {
    const sheet = $('#mobile-parity-sheet');
    if (sheet) sheet.hidden = true;
    document.body.classList.remove('mobile-parity-open');
  }

  async function launch(kind) {
    closeMore();
    if (!App.state.user) return;
    if (kind === 'reminders') return App.ui.navigate('reminders');
    if (kind === 'demands') return App.ui.navigate('demands');
    if (kind === 'history') return App.ui.navigate('history');
    if (kind === 'users') return openUsers();
    if (kind === 'chat') return App.ui.navigate('chat');
    if (kind === 'settings') return App.ui.showSettings();
    if (kind === 'backup') return App.data.export();
    const existing = document.querySelector(`[data-tool="${kind === 'alarms' ? 'alarms' : kind}"]`);
    if (existing) existing.click();
  }

  async function openUsers() {
    try {
      App.state.allUsers = await lumina.auth.getUsers();
      App.ui.navigate('users');
      App.users?.render?.();
    } catch (e) {
      App.showToast(e.message || 'Não foi possível carregar usuários', 'error');
    }
  }

  function overlay(title, body) {
    const root = $('#mobile-parity-overlay');
    root.innerHTML = `<section class="mobile-parity-view"><header><button id="parity-back" type="button">${icons.close}</button><h2>${esc(title)}</h2><span></span></header><div class="mobile-parity-body">${body}</div></section>`;
    root.hidden = false;
    $('#parity-back', root).onclick = closeOverlay;
    return root;
  }
  function closeOverlay() {
    const root = $('#mobile-parity-overlay');
    if (root) { root.hidden = true; root.innerHTML = ''; }
  }

  function installDemands() {
    App.demands = {
      async render() {
        if (!App.state.user) return;
        const rows = await lumina.demands.getAll(App.state.user.id);
        const list = $('#demands-list');
        const empty = $('#demands-empty');
        const badge = $('#demands-count');
        if (badge) { badge.textContent = String(rows.length); badge.style.display = rows.length ? '' : 'none'; }
        if (empty) empty.style.display = rows.length ? 'none' : 'flex';
        if (!list) return;
        list.innerHTML = rows.map(d => `
          <article class="demand-card" data-demand-id="${esc(d.id)}">
            <div class="demand-card-main">
              <div class="demand-card-title">${esc(d.title)}</div>
              <div class="demand-card-desc">${esc(d.description || 'Sem descrição')}</div>
              <div class="demand-card-meta"><span>${esc(statusLabel(d.status))}</span><span>${esc(priorityLabel(d.priority))}</span><span>${Number(d.steps_count || 0)} etapa(s)</span></div>
            </div>
            <div class="demand-card-actions"><button type="button" data-demand-edit="${esc(d.id)}">Editar</button><button type="button" class="danger" data-demand-delete="${esc(d.id)}">Excluir</button></div>
          </article>`).join('');
        $$('[data-demand-edit]', list).forEach(b => b.onclick = () => App.demands.openEditor(b.dataset.demandEdit));
        $$('[data-demand-delete]', list).forEach(b => b.onclick = () => App.showConfirm('Excluir demanda', 'Deseja excluir esta demanda?', async () => { await lumina.demands.delete(b.dataset.demandDelete); await App.demands.render(); }));
      },
      async openEditor(id = null) {
        currentDemandId = id || null;
        const d = id ? await lumina.demands.getOne(id) : null;
        const root = overlay(id ? 'Editar demanda' : 'Nova demanda', `
          <form id="mobile-demand-form" class="mobile-parity-form">
            <label>Título<input id="mobile-demand-title" required maxlength="120" value="${esc(d?.title || '')}"></label>
            <label>Descrição<textarea id="mobile-demand-description" rows="5">${esc(d?.description || '')}</textarea></label>
            <div class="mobile-parity-row">
              <label>Status<select id="mobile-demand-status"><option value="pending">Pendente</option><option value="in_progress">Em andamento</option><option value="completed">Concluída</option><option value="paused">Pausada</option></select></label>
              <label>Prioridade<select id="mobile-demand-priority"><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label>
            </div>
            <label>Tags<input id="mobile-demand-tags" value="${esc((d?.tags || []).join(', '))}" placeholder="trabalho, pessoal"></label>
            <label>Etapas<textarea id="mobile-demand-steps" rows="6" placeholder="Uma etapa por linha">${esc((d?.steps || []).map(s => s.title || s.content).filter(Boolean).join('\n'))}</textarea></label>
            <button class="mobile-parity-primary" type="submit">Salvar demanda</button>
          </form>`);
        $('#mobile-demand-status', root).value = d?.status || 'pending';
        $('#mobile-demand-priority', root).value = d?.priority || 'normal';
        $('#mobile-demand-form', root).onsubmit = async e => {
          e.preventDefault();
          const data = {
            userId: App.state.user.id,
            title: $('#mobile-demand-title', root).value.trim(),
            description: $('#mobile-demand-description', root).value,
            status: $('#mobile-demand-status', root).value,
            priority: $('#mobile-demand-priority', root).value,
            tags: $('#mobile-demand-tags', root).value.split(',').map(x => x.trim()).filter(Boolean),
            steps: $('#mobile-demand-steps', root).value.split('\n').map(x => x.trim()).filter(Boolean).map(title => ({ title, content: '' }))
          };
          if (!data.title) return;
          if (currentDemandId) await lumina.demands.update({ id: currentDemandId, ...data });
          else await lumina.demands.create(data);
          closeOverlay();
          await App.demands.render();
          App.showToast('Demanda salva!', 'success');
        };
      }
    };
  }
  function statusLabel(s) { return ({pending:'Pendente',in_progress:'Em andamento',completed:'Concluída',paused:'Pausada'})[s] || s || 'Pendente'; }
  function priorityLabel(s) { return ({low:'Baixa',normal:'Normal',high:'Alta',urgent:'Urgente'})[s] || s || 'Normal'; }

  function installHistory() {
    App.history = {
      async render() {
        if (!App.state.user) return;
        const rows = await lumina.notes.getHistory(App.state.user.id);
        const list = $('#history-list');
        const empty = $('#history-empty');
        if (empty) empty.style.display = rows.length ? 'none' : 'flex';
        if (!list) return;
        list.innerHTML = rows.map(r => `<article class="history-item"><div><strong>${esc(r.title || 'Sem título')}</strong><small>Excluído em ${esc(fmt(r.deleted_at))}</small></div><div class="history-actions"><button data-history-restore="${esc(r.id)}">Restaurar</button><button class="danger" data-history-purge="${esc(r.id)}">Excluir definitivamente</button></div></article>`).join('');
        $$('[data-history-restore]', list).forEach(b => b.onclick = async () => { await lumina.notes.restore(b.dataset.historyRestore); await App.ui.loadAll(); await App.history.render(); });
        $$('[data-history-purge]', list).forEach(b => b.onclick = () => App.showConfirm('Excluir definitivamente', 'Esta ação não pode ser desfeita.', async () => { await lumina.notes.purge(b.dataset.historyPurge); await App.history.render(); }));
      }
    };
  }

  function installChat() {
    const chat = App.chat || {};
    Object.assign(chat, {
      async loadConversations() {
        if (!App.state.user) return;
        const rows = await lumina.chat.getConversations(App.state.user.id);
        const list = $('#chat-conv-list');
        if (!list) return;
        list.innerHTML = rows.length ? rows.map(c => `<button type="button" class="chat-conv-item ${c.id === currentConversationId ? 'active' : ''}" data-chat-id="${esc(c.id)}"><strong>${esc(c.title || 'Conversa')}</strong><span>${esc((c.last_message || '').slice(0, 70))}</span></button>`).join('') : '<div class="mobile-empty-copy">Nenhuma conversa ainda</div>';
        $$('[data-chat-id]', list).forEach(b => b.onclick = () => chat.openConversation(b.dataset.chatId));
      },
      async newConversation() {
        const c = await lumina.chat.createConversation({ userId: App.state.user.id, title: 'Nova conversa' });
        currentConversationId = c.id;
        await chat.openConversation(c.id);
        await chat.loadConversations();
      },
      async openConversation(id) {
        const c = await lumina.chat.getConversation(id);
        if (!c) return;
        currentConversationId = id;
        const title = $('#chat-main-title'); if (title) title.textContent = c.title || 'Metrys Intelligence';
        const actions = $('#chat-main-actions'); if (actions) actions.style.display = 'flex';
        renderChatMessages(c.messages || []);
        await chat.loadConversations();
      },
      async send() {
        const input = $('#chat-input');
        const text = input?.value.trim();
        if (!text || !App.state.user) return;
        input.value = ''; chat.autoResize(input);
        if (!currentConversationId) {
          const c = await lumina.chat.createConversation({ userId: App.state.user.id, title: text.slice(0, 42) || 'Nova conversa' });
          currentConversationId = c.id;
        }
        await lumina.chat.addMessage({ conversationId: currentConversationId, role: 'user', content: text });
        let history = await lumina.chat.getHistory(currentConversationId);
        renderChatMessages(history);
        const sendBtn = $('#chat-send-btn'); if (sendBtn) sendBtn.disabled = true;
        const result = await lumina.ai.chat(history.map(m => ({ role: m.role, content: m.content })));
        if (sendBtn) sendBtn.disabled = false;
        if (result.success) {
          await lumina.chat.addMessage({ conversationId: currentConversationId, role: 'assistant', content: result.text });
        } else {
          await lumina.chat.addMessage({ conversationId: currentConversationId, role: 'assistant', content: `Não consegui responder: ${result.error || 'erro desconhecido'}` });
        }
        history = await lumina.chat.getHistory(currentConversationId);
        renderChatMessages(history);
        await chat.loadConversations();
      },
      handleKey(event) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); chat.send(); } },
      autoResize(el) { if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 150)}px`; },
      sendSuggestion(text) { const input = $('#chat-input'); if (!input) return; input.value = text; chat.send(); },
      async togglePin() {
        if (!currentConversationId) return;
        const c = await lumina.chat.getConversation(currentConversationId); if (!c) return;
        await lumina.chat.updateConversation({ id: currentConversationId, is_pinned: !Boolean(c.is_pinned) });
        await chat.loadConversations();
      },
      async archiveConversation() {
        if (!currentConversationId) return;
        await lumina.chat.updateConversation({ id: currentConversationId, is_archived: true });
        currentConversationId = null; clearChat(); await chat.loadConversations();
      },
      deleteCurrentConversation() {
        if (!currentConversationId) return;
        App.showConfirm('Excluir conversa', 'Deseja apagar esta conversa?', async () => { await lumina.chat.deleteConversation(currentConversationId, App.state.user.id); currentConversationId = null; clearChat(); await chat.loadConversations(); });
      },
      pickFile() { $('#chat-file-input')?.click(); },
      async handleFile(event) {
        const files = [...(event.target.files || [])];
        if (!files.length) return;
        const input = $('#chat-input');
        if (input) input.value = `${input.value}${input.value ? '\n' : ''}${files.map(f => `[Anexo: ${f.name}]`).join('\n')}`;
        event.target.value = '';
        chat.autoResize(input);
      }
    });
    App.chat = chat;
  }

  function renderChatMessages(messages) {
    const box = $('#chat-messages'); if (!box) return;
    box.innerHTML = messages.length ? messages.map(m => `<div class="chat-msg ${m.role === 'user' ? 'user' : 'assistant'}"><div class="chat-msg-content"><div class="chat-msg-text">${esc(m.content).replace(/\n/g,'<br>')}</div><div class="chat-msg-time">${esc(fmt(m.created_at))}</div></div></div>`).join('') : '<div class="chat-welcome"><h2>Metrys Intelligence</h2><p>Converse com a IA usando sua chave configurada nas configurações.</p></div>';
    box.scrollTop = box.scrollHeight;
  }
  function clearChat() { renderChatMessages([]); const actions = $('#chat-main-actions'); if (actions) actions.style.display = 'none'; }

  function patchNavigation() {
    const original = App.ui.navigate.bind(App.ui);
    App.ui.navigate = async function(page) {
      original(page);
      try {
        if (page === 'demands') await App.demands.render();
        if (page === 'history') await App.history.render();
        if (page === 'users') { App.state.allUsers = await lumina.auth.getUsers(); App.users?.render?.(); }
        if (page === 'chat') await App.chat.loadConversations();
      } catch (e) {
        console.error('[Lumina] Navegação mobile', page, e);
        App.showToast(e.message || `Erro ao abrir ${page}`, 'error');
      }
    };

    /* O chat de usuário existente chama App.chat.autoResize. Mantemos essa função disponível. */
    const userChat = $('#user-chat-input');
    if (userChat && !userChat.dataset.parityResize) {
      userChat.dataset.parityResize = '1';
      userChat.addEventListener('input', () => App.chat.autoResize(userChat));
    }

    document.addEventListener('backbutton', () => {
      if (!$('#mobile-parity-overlay')?.hidden) { closeOverlay(); return; }
      if (!$('#mobile-parity-sheet')?.hidden) { closeMore(); }
    }, false);
  }

  waitForApp();
})();
