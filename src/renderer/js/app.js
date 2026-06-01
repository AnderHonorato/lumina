/* ==========================================
   LUMINA NOTES - APP.JS
   Renderer Process Logic
   ========================================== */

const App = (() => {
  // ==================== STATE ====================
  const state = {
    user: null,
    notes: [],
    reminders: [],
    calendarEvents: [],
    settings: null,
    currentPage: 'notes',
    currentNoteId: null,
    noteFilter: 'all',
    noteView: 'timeline',
    activeTag: null,
    searchQuery: '',
    calendarMonth: new Date().getMonth() + 1,
    calendarYear: new Date().getFullYear(),
    editorNote: {
      id: null, title: '', content: '', type: 'note', mood: null,
      tags: [], attachments: [], color: 'default', isPinned: false, isFavorite: false
    },
    currentReminder: {
      id: null, color: '#6C63FF'
    },
    currentEvent: { id: null },
    pendingConfirm: null
  };

  // ==================== UTILS ====================
  const utils = {
    formatDate(dateStr, options = {}) {
      const d = new Date(dateStr);
      if (isNaN(d)) return '';
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', ...options });
    },
    formatDateTime(dateStr) {
      const d = new Date(dateStr);
      if (isNaN(d)) return '';
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },
    formatTime(dateStr) {
      const d = new Date(dateStr);
      if (isNaN(d)) return '';
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    },
    formatRelative(dateStr) {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now - d;
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (mins < 1) return 'Agora';
      if (mins < 60) return `${mins}min`;
      if (hours < 24) return `${hours}h`;
      if (days < 7) return `${days}d`;
      return utils.formatDate(dateStr);
    },
    groupByDate(items, dateField = 'created_at') {
      const groups = {};
      items.forEach(item => {
        const d = new Date(item[dateField]);
        const key = d.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });
      return groups;
    },
    sanitize(str) {
      return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
    getMimeIcon(mimeType, fileName) {
      const ext = (fileName || '').split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
      if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
      if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return 'audio';
      if (['pdf'].includes(ext)) return 'pdf';
      if (['doc', 'docx'].includes(ext)) return 'word';
      if (['xls', 'xlsx'].includes(ext)) return 'excel';
      if (['zip', 'rar', '7z', 'tar'].includes(ext)) return 'archive';
      return 'file';
    },
    getMoodEmoji(mood) {
      const moods = { great: '😄', good: '😊', neutral: '😐', bad: '😔', terrible: '😢', excited: '🤩', anxious: '😰', grateful: '🙏' };
      return moods[mood] || '';
    },
    todayDateString() {
      return new Date().toISOString().split('T')[0];
    },
    nowTimeString() {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
  };

  // ==================== TOAST ====================
  function showToast(message, type = 'info') {
    const icons = {
      success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
      error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-text">${utils.sanitize(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ==================== CONFIRM ====================
  function showConfirm(title, message, onOk, isDanger = true) {
    const dialog = document.getElementById('confirm-dialog');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const icon = document.getElementById('confirm-icon');
    if (isDanger) icon.classList.add('danger-icon');
    else icon.classList.remove('danger-icon');
    dialog.style.display = 'flex';
    setTimeout(() => dialog.classList.add('open'), 10);

    state.pendingConfirm = onOk;
    document.getElementById('confirm-ok').onclick = () => {
      closeConfirm();
      if (state.pendingConfirm) state.pendingConfirm();
    };
    document.getElementById('confirm-cancel').onclick = closeConfirm;
  }

  function closeConfirm() {
    const dialog = document.getElementById('confirm-dialog');
    dialog.classList.remove('open');
    setTimeout(() => { dialog.style.display = 'none'; }, 200);
  }

  // ==================== AUTH ====================
  const auth = {
    async init() {
      const users = await lumina.auth.getUsers();
      const list = document.getElementById('quick-users-list');
      if (users && users.length > 0) {
        document.getElementById('login-users').style.display = 'block';
        list.innerHTML = users.map(u => `
          <button class="quick-user-chip" onclick="App.auth.quickLogin('${u.id}', '${utils.sanitize(u.username)}')">
            <div class="quick-user-avatar" style="background:${u.avatar_color || '#6C63FF'}">${(u.display_name || u.username)[0].toUpperCase()}</div>
            ${utils.sanitize(u.display_name || u.username)}
          </button>
        `).join('');
      }
    },
    async login() {
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const errEl = document.getElementById('login-error');
      errEl.textContent = '';

      if (!username || !password) { errEl.textContent = 'Preencha todos os campos'; return; }

      const result = await lumina.auth.login({ username, password });
      if (result.success) {
        auth.afterLogin(result.user);
      } else {
        errEl.textContent = result.error || 'Erro ao entrar';
      }
    },
    async quickLogin(userId, username) {
      const password = prompt(`Senha para ${username}:`);
      if (!password) return;
      const result = await lumina.auth.login({ username, password });
      if (result.success) {
        auth.afterLogin(result.user);
      } else {
        showToast(result.error || 'Senha incorreta', 'error');
      }
    },
    async register() {
      const name = document.getElementById('reg-name').value.trim();
      const username = document.getElementById('reg-username').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const errEl = document.getElementById('register-error');
      errEl.textContent = '';

      if (!username || !password) { errEl.textContent = 'Usuário e senha são obrigatórios'; return; }
      if (password.length < 6) { errEl.textContent = 'Senha deve ter pelo menos 6 caracteres'; return; }

      const result = await lumina.auth.register({ username, email, password, displayName: name || username });
      if (result.success) {
        auth.afterLogin(result.user);
      } else {
        errEl.textContent = result.error || 'Erro ao criar conta';
      }
    },
    async afterLogin(user) {
      state.user = user;

      // Mostrar main screen
      document.getElementById('auth-screen').classList.remove('active');
      document.getElementById('main-screen').classList.add('active');

      // Preencher UI
      document.getElementById('user-avatar').textContent = (user.display_name || user.username)[0].toUpperCase();
      document.getElementById('user-avatar').style.background = user.avatar_color || '#6C63FF';
      document.getElementById('user-name').textContent = user.display_name || user.username;
      document.getElementById('user-handle').textContent = '@' + user.username;

      // Carregar dados
      await ui.loadAll();

      // Carregar settings
      const settings = await lumina.settings.get(user.id);
      state.settings = settings;
      applySettings(settings);
    },
    logout() {
      showConfirm('Sair', 'Deseja sair da conta?', () => {
        state.user = null;
        state.notes = [];
        state.reminders = [];
        document.getElementById('main-screen').classList.remove('active');
        document.getElementById('auth-screen').classList.add('active');
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        auth.init();
      });
    }
  };

  // ==================== UI ====================
  const ui = {
    navigate(page) {
      state.currentPage = page;
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.getElementById(`page-${page}`)?.classList.add('active');
      document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

      if (page === 'notes') notes.render();
      if (page === 'diary') diary.render();
      if (page === 'reminders') remindersUI.render();
      if (page === 'calendar') calendarUI.render();
    },
    async loadAll() {
      if (!state.user) return;
      const [notesData, remindersData] = await Promise.all([
        lumina.notes.getAll(state.user.id),
        lumina.reminders.getAll(state.user.id)
      ]);
      state.notes = notesData || [];
      state.reminders = remindersData || [];
      notes.render();
      diary.render();
      remindersUI.render();
      updateBadges();
      updateTags();
    },
    clearSearch() {
      document.getElementById('search-input').value = '';
      document.getElementById('search-clear').style.display = 'none';
      state.searchQuery = '';
      notes.render();
    },
    showSettings() {
      const modal = document.getElementById('settings-modal');
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('open'), 10);

      // Preencher com dados atuais
      if (state.user) {
        document.getElementById('prof-name').value = state.user.display_name || '';
        document.getElementById('prof-email').value = state.user.email || '';

        // Marcar avatar color atual
        document.querySelectorAll('#avatar-colors .accent-opt').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.color === state.user.avatar_color);
        });
      }

      if (state.settings) {
        // Marcar tema
        document.querySelectorAll('.theme-opt').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.theme === state.settings.theme);
        });
        // Marcar accent
        document.querySelectorAll('.accent-opt[data-color]').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.color === state.settings.accent_color);
        });
        // Marcar font size
        document.querySelectorAll('.font-size-opt').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.size === state.settings.font_size);
        });
      }
    },
    closeModal(id) {
      const modal = document.getElementById(id);
      modal.classList.remove('open');
      setTimeout(() => { modal.style.display = 'none'; }, 200);
    },
    closeAllPopups() {
      document.querySelectorAll('.popup-panel').forEach(p => p.style.display = 'none');
    }
  };

  function updateBadges() {
    const noteCount = state.notes.filter(n => n.type !== 'diary').length;
    const diaryCount = state.notes.filter(n => n.type === 'diary').length;
    const pendingReminders = state.reminders.filter(r => !r.is_completed).length;

    document.getElementById('notes-count').textContent = noteCount;
    document.getElementById('diary-count').textContent = diaryCount;
    document.getElementById('reminders-count').textContent = pendingReminders;

    const badge = document.getElementById('reminders-count');
    badge.classList.toggle('has-items', pendingReminders > 0);

    document.getElementById('notes-subtitle').textContent = `${noteCount} nota${noteCount !== 1 ? 's' : ''}`;
    document.getElementById('reminders-subtitle').textContent = `${pendingReminders} pendente${pendingReminders !== 1 ? 's' : ''}`;
  }

  function updateTags() {
    const tags = new Set();
    state.notes.forEach(n => (n.tags || []).forEach(t => tags.add(t)));
    
    const list = document.getElementById('tags-list');
    const filterRow = document.getElementById('tag-filters');

    if (tags.size === 0) {
      list.innerHTML = '<span style="font-size:11px;color:var(--text-3)">Sem tags</span>';
      filterRow.innerHTML = '';
      return;
    }

    list.innerHTML = Array.from(tags).map(tag => `
      <button class="tag-chip ${state.activeTag === tag ? 'active' : ''}" onclick="App.ui.filterByTag('${utils.sanitize(tag)}')">
        #${utils.sanitize(tag)}
      </button>
    `).join('');

    filterRow.innerHTML = Array.from(tags).map(tag => `
      <button class="filter-chip ${state.activeTag === tag ? 'active' : ''}" onclick="App.ui.filterByTag('${utils.sanitize(tag)}')">
        #${utils.sanitize(tag)}
      </button>
    `).join('');
  }

  ui.filterByTag = function(tag) {
    state.activeTag = state.activeTag === tag ? null : tag;
    updateTags();
    notes.render();
  };

  function applySettings(settings) {
    if (!settings) return;
    document.body.className = '';
    document.body.classList.add(`theme-${settings.theme || 'dark'}`);
    document.body.classList.add(`font-${settings.font_size || 'medium'}`);

    // Accent color
    if (settings.accent_color) {
      document.documentElement.style.setProperty('--accent', settings.accent_color);
      // Compute lighter variant
      document.documentElement.style.setProperty('--accent-bg', settings.accent_color + '18');
      document.documentElement.style.setProperty('--accent-border', settings.accent_color + '44');
      document.documentElement.style.setProperty('--accent-2', settings.accent_color + 'cc');
    }
  }

  // ==================== NOTES ====================
  const notes = {
    setView(view) {
      state.noteView = view;
      document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
      notes.render();
    },
    setFilter(filter) {
      state.noteFilter = filter;
      state.activeTag = null;
      document.querySelectorAll('.filter-chip[data-filter]').forEach(c => c.classList.toggle('active', c.dataset.filter === filter));
      updateTags();
      notes.render();
    },
    getFiltered() {
      let items = state.notes.filter(n => n.type !== 'diary');
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        items = items.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || (n.tags || []).some(t => t.toLowerCase().includes(q)));
      }
      if (state.activeTag) {
        items = items.filter(n => (n.tags || []).includes(state.activeTag));
      }
      if (state.noteFilter === 'pinned') items = items.filter(n => n.is_pinned);
      if (state.noteFilter === 'favorites') items = items.filter(n => n.is_favorite);
      return items;
    },
    render() {
      const container = document.getElementById('timeline-container');
      const empty = document.getElementById('notes-empty');
      const items = notes.getFiltered();

      if (items.length === 0) {
        empty.style.display = 'flex';
        container.innerHTML = '';
        return;
      }
      empty.style.display = 'none';

      if (state.noteView === 'grid') {
        container.classList.add('grid-view');
        container.innerHTML = items.map(n => notes.renderCard(n)).join('');
      } else {
        container.classList.remove('grid-view');
        const groups = utils.groupByDate(items, 'created_at');
        container.innerHTML = Object.entries(groups)
          .reverse()
          .map(([date, groupNotes]) => `
            <div class="timeline-group">
              <div class="timeline-date-label">
                <span class="timeline-date-text">${date}</span>
                <div class="timeline-date-line"></div>
              </div>
              ${groupNotes.map((n, i) => `
                <div class="timeline-entry" style="animation-delay:${i * 0.05}s">
                  <div class="timeline-spine">
                    <div class="timeline-dot" style="background:${n.is_pinned ? 'var(--warning)' : n.color && n.color !== 'default' ? 'var(--accent)' : 'var(--accent)'}"></div>
                    ${i < groupNotes.length - 1 ? '<div class="timeline-line"></div>' : ''}
                  </div>
                  ${notes.renderCard(n)}
                </div>
              `).join('')}
            </div>
          `).join('');
      }
    },
    renderCard(n) {
      const hasAttachments = (n.attachments || []).length > 0;
      const mood = n.mood ? `<span class="card-badge badge-mood">${utils.getMoodEmoji(n.mood)}</span>` : '';
      const pin = n.is_pinned ? `<span class="card-badge badge-pin"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="var(--bg)"/></svg></span>` : '';
      const fav = n.is_favorite ? `<span class="card-badge badge-fav"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>` : '';
      const tags = (n.tags || []).slice(0, 3).map(t => `<span class="note-tag-small">#${utils.sanitize(t)}</span>`).join('');
      const attach = hasAttachments ? `<span class="note-card-attachments"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>${n.attachments.length}</span>` : '';

      return `
        <div class="note-card color-${n.color || 'default'}" onclick="App.notes.openEditor(null, '${n.id}')">
          <div class="note-card-header">
            <div class="note-card-title">${utils.sanitize(n.title || 'Sem título')}</div>
            <div class="note-card-badges">${mood}${pin}${fav}</div>
          </div>
          ${n.content ? `<div class="note-card-preview">${utils.sanitize(n.content)}</div>` : ''}
          <div class="note-card-footer">
            <span class="note-card-time">${utils.formatRelative(n.updated_at || n.created_at)}</span>
            <div class="note-card-tags">${tags}</div>
            ${attach}
          </div>
        </div>
      `;
    },
    openEditor(type = null, noteId = null) {
      const now = new Date();
      
      if (noteId) {
        // Editar nota existente
        const note = state.notes.find(n => n.id === noteId);
        if (!note) return;
        Object.assign(state.editorNote, {
          id: note.id, title: note.title, content: note.content,
          type: note.type, mood: note.mood, tags: [...(note.tags || [])],
          attachments: [...(note.attachments || [])], color: note.color,
          isPinned: note.is_pinned, isFavorite: note.is_favorite
        });
        document.getElementById('editor-delete-btn').style.display = 'flex';
      } else {
        // Nova nota
        state.editorNote = {
          id: null, title: '', content: '', type: type || 'note',
          mood: null, tags: [], attachments: [], color: 'default',
          isPinned: false, isFavorite: false
        };
        document.getElementById('editor-delete-btn').style.display = 'none';
      }

      // Preencher UI do editor
      document.getElementById('note-title').value = state.editorNote.title;
      document.getElementById('note-content').value = state.editorNote.content;
      document.getElementById('editor-type-badge').textContent = state.editorNote.type === 'diary' ? 'Diário' : 'Nota';
      document.getElementById('editor-date').textContent = utils.formatDateTime(now);
      
      // Pin/Fav buttons
      const pinBtn = document.getElementById('editor-pin-btn');
      const favBtn = document.getElementById('editor-fav-btn');
      pinBtn.classList.toggle('active-state', state.editorNote.isPinned);
      favBtn.classList.toggle('fav-active', state.editorNote.isFavorite);

      // Mood button
      document.getElementById('editor-mood-wrap').style.display = state.editorNote.type === 'diary' ? 'flex' : 'none';

      notes.renderTagsEditor();
      notes.renderAttachments();

      const modal = document.getElementById('editor-modal');
      modal.style.display = 'flex';
      setTimeout(() => {
        modal.classList.add('open');
        document.getElementById('note-title').focus();
      }, 10);
    },
    renderTagsEditor() {
      const display = document.getElementById('note-tags-display');
      display.innerHTML = state.editorNote.tags.map(tag => `
        <span class="note-tag-editor">
          #${utils.sanitize(tag)}
          <button onclick="App.notes.removeTag('${utils.sanitize(tag)}')">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </span>
      `).join('');
    },
    removeTag(tag) {
      state.editorNote.tags = state.editorNote.tags.filter(t => t !== tag);
      notes.renderTagsEditor();
    },
    togglePin() {
      state.editorNote.isPinned = !state.editorNote.isPinned;
      document.getElementById('editor-pin-btn').classList.toggle('active-state', state.editorNote.isPinned);
    },
    toggleFavorite() {
      state.editorNote.isFavorite = !state.editorNote.isFavorite;
      document.getElementById('editor-fav-btn').classList.toggle('fav-active', state.editorNote.isFavorite);
    },
    showColorPicker() {
      ui.closeAllPopups();
      const popup = document.getElementById('color-picker-popup');
      popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
    },
    setNoteColor(color) {
      state.editorNote.color = color;
      ui.closeAllPopups();
      document.querySelectorAll('.color-opt').forEach(b => b.classList.toggle('active', b.dataset.color === color));
    },
    showMoodPicker() {
      ui.closeAllPopups();
      const popup = document.getElementById('mood-picker-popup');
      popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
    },
    setMood(mood) {
      state.editorNote.mood = mood;
      ui.closeAllPopups();
      const btn = document.getElementById('editor-mood-btn');
      btn.title = mood ? utils.getMoodEmoji(mood) : 'Humor';
      if (mood) btn.innerHTML = `<span style="font-size:16px">${utils.getMoodEmoji(mood)}</span>`;
      else btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`;
    },
    async attachFile() {
      const result = await lumina.dialog.openFile({
        title: 'Selecionar arquivo',
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Todos os arquivos', extensions: ['*'] },
          { name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
          { name: 'Vídeos', extensions: ['mp4', 'webm', 'mov', 'avi'] },
          { name: 'Documentos', extensions: ['pdf', 'doc', 'docx', 'txt'] },
        ]
      });

      if (result.canceled || !result.filePaths.length) return;

      for (const filePath of result.filePaths) {
        const fileName = filePath.split(/[\\/]/).pop();
        const fs_result = await lumina.files.readAsBase64(filePath);
        if (!fs_result.success) { showToast('Erro ao ler arquivo', 'error'); continue; }

        const saved = await lumina.files.save({
          fileName,
          data: fs_result.data,
          userId: state.user.id
        });

        if (saved.success) {
          state.editorNote.attachments.push({
            originalName: fileName,
            savedName: saved.savedName,
            path: saved.path,
            type: utils.getMimeIcon(null, fileName)
          });
          notes.renderAttachments();
        }
      }
    },
    renderAttachments() {
      const area = document.getElementById('attachments-area');
      area.innerHTML = state.editorNote.attachments.map((att, i) => {
        const isImage = att.type === 'image';
        const isVideo = att.type === 'video';
        let preview = '';

        if (isImage) {
          preview = `<img class="attachment-preview" src="file://${att.path}" alt="${utils.sanitize(att.originalName)}" onerror="this.style.display='none'">`;
        } else if (isVideo) {
          preview = `<video class="attachment-preview-video" src="file://${att.path}" muted></video>`;
        } else {
          const icons = {
            pdf: '📄', word: '📝', excel: '📊', audio: '🎵', archive: '📦', file: '📎'
          };
          const ext = att.originalName.split('.').pop().toUpperCase();
          preview = `<div class="attachment-icon-preview">${icons[att.type] || '📎'}<span>${ext}</span></div>`;
        }

        return `
          <div class="attachment-item" onclick="App.notes.openAttachment(${i})">
            ${preview}
            <span class="attachment-name">${utils.sanitize(att.originalName)}</span>
            <button class="attachment-remove" onclick="event.stopPropagation();App.notes.removeAttachment(${i})">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        `;
      }).join('');
    },
    openAttachment(idx) {
      const att = state.editorNote.attachments[idx];
      if (att) lumina.files.open(att.path);
    },
    removeAttachment(idx) {
      state.editorNote.attachments.splice(idx, 1);
      notes.renderAttachments();
    },
    async saveNote() {
      const title = document.getElementById('note-title').value.trim();
      const content = document.getElementById('note-content').value;

      if (!title && !content) { showToast('Adicione um título ou conteúdo', 'error'); return; }

      const noteData = {
        userId: state.user.id,
        title: title || 'Sem título',
        content,
        type: state.editorNote.type,
        mood: state.editorNote.mood,
        tags: state.editorNote.tags,
        attachments: state.editorNote.attachments,
        color: state.editorNote.color,
        isPinned: state.editorNote.isPinned,
        isFavorite: state.editorNote.isFavorite
      };

      let result;
      if (state.editorNote.id) {
        result = await lumina.notes.update({ id: state.editorNote.id, ...noteData });
        const idx = state.notes.findIndex(n => n.id === state.editorNote.id);
        if (idx !== -1) state.notes[idx] = result;
      } else {
        result = await lumina.notes.create(noteData);
        state.notes.unshift(result);
        state.editorNote.id = result.id;
        document.getElementById('editor-delete-btn').style.display = 'flex';
      }

      notes.render();
      diary.render();
      updateBadges();
      updateTags();
      showToast('Nota salva!', 'success');
    },
    async deleteCurrentNote() {
      if (!state.editorNote.id) return;
      showConfirm('Excluir nota', 'Esta ação não pode ser desfeita.', async () => {
        await lumina.notes.delete(state.editorNote.id);
        state.notes = state.notes.filter(n => n.id !== state.editorNote.id);
        ui.closeModal('editor-modal');
        notes.render();
        diary.render();
        updateBadges();
        showToast('Nota excluída', 'info');
      });
    }
  };

  // ==================== DIARY ====================
  const diary = {
    render() {
      const container = document.getElementById('diary-timeline');
      const empty = document.getElementById('diary-empty');
      const items = state.notes.filter(n => n.type === 'diary').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      if (items.length === 0) {
        empty.style.display = 'flex';
        container.innerHTML = '';
        return;
      }
      empty.style.display = 'none';

      const groups = utils.groupByDate(items, 'created_at');
      container.innerHTML = Object.entries(groups).map(([date, groupNotes]) => `
        <div class="timeline-group">
          <div class="timeline-date-label">
            <span class="timeline-date-text">${date}</span>
            <div class="timeline-date-line"></div>
          </div>
          ${groupNotes.map((n, i) => `
            <div class="timeline-entry" style="animation-delay:${i * 0.06}s">
              <div class="timeline-spine">
                <div class="timeline-dot" style="background:${n.mood ? 'var(--success)' : 'var(--accent)'}"></div>
                ${i < groupNotes.length - 1 ? '<div class="timeline-line"></div>' : ''}
              </div>
              <div class="note-card color-${n.color || 'default'}" onclick="App.notes.openEditor('diary', '${n.id}')">
                <div class="note-card-header">
                  <div class="note-card-title">${utils.sanitize(n.title)}</div>
                  <div class="note-card-badges">
                    ${n.mood ? `<span class="card-badge badge-mood">${utils.getMoodEmoji(n.mood)}</span>` : ''}
                    ${n.is_favorite ? `<span class="card-badge badge-fav"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>` : ''}
                  </div>
                </div>
                ${n.content ? `<div class="note-card-preview">${utils.sanitize(n.content)}</div>` : ''}
                <div class="note-card-footer">
                  <span class="note-card-time">${utils.formatTime(n.created_at)}</span>
                  ${(n.attachments || []).length ? `<span class="note-card-attachments"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>${n.attachments.length}</span>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('');
    }
  };

  // ==================== REMINDERS ====================
  const remindersUI = {
    render() {
      const upcoming = document.getElementById('reminders-upcoming');
      const completed = document.getElementById('reminders-completed');
      const empty = document.getElementById('reminders-empty');

      const all = state.reminders.sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at));
      const active = all.filter(r => !r.is_completed);
      const done = all.filter(r => r.is_completed);

      if (all.length === 0) {
        empty.style.display = 'flex';
        upcoming.innerHTML = '';
        completed.innerHTML = '';
        return;
      }
      empty.style.display = 'none';

      upcoming.innerHTML = active.length === 0 
        ? '<p style="color:var(--text-3);font-size:var(--fs-sm);padding:8px 0">Nenhum lembrete pendente 🎉</p>'
        : active.map(r => remindersUI.renderCard(r)).join('');

      completed.innerHTML = done.slice(0, 5).map(r => remindersUI.renderCard(r)).join('');
    },
    renderCard(r) {
      const priorityLabel = { high: 'Alta', normal: 'Normal', low: 'Baixa' }[r.priority] || 'Normal';
      const noteLink = r.note_id ? `
        <span class="reminder-note-link" onclick="App.remindersUI.goToNote('${r.note_id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/></svg>
          ${utils.sanitize(r.note_title || 'Nota vinculada')}
        </span>` : '';

      const isOverdue = !r.is_completed && new Date(r.remind_at) < new Date();

      return `
        <div class="reminder-card ${r.is_completed ? 'completed' : ''}" style="border-left: 3px solid ${r.color || '#6C63FF'}">
          <button class="reminder-check" onclick="App.remindersUI.complete('${r.id}')" title="Marcar como feito">
            ${r.is_completed ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
          </button>
          <div class="reminder-body">
            <div class="reminder-title">${utils.sanitize(r.title)}</div>
            ${r.description ? `<div class="reminder-desc">${utils.sanitize(r.description)}</div>` : ''}
            <div class="reminder-meta">
              <span class="reminder-time" style="${isOverdue ? 'color:var(--danger)' : ''}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${utils.formatDateTime(r.remind_at)}
                ${isOverdue ? '⚠️' : ''}
              </span>
              <span class="reminder-priority priority-${r.priority || 'normal'}">${priorityLabel}</span>
              ${noteLink}
            </div>
          </div>
          <div class="reminder-actions">
            ${!r.is_completed ? `<button class="reminder-action-btn" onclick="App.reminders.openEditor('${r.id}')" title="Editar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>` : ''}
            <button class="reminder-action-btn del" onclick="App.remindersUI.delete('${r.id}')" title="Excluir">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>
      `;
    },
    async complete(id) {
      await lumina.reminders.complete(id);
      const r = state.reminders.find(r => r.id === id);
      if (r) r.is_completed = 1;
      remindersUI.render();
      updateBadges();
      showToast('Lembrete concluído!', 'success');
    },
    async delete(id) {
      showConfirm('Excluir lembrete', 'Deseja excluir este lembrete?', async () => {
        await lumina.reminders.delete(id);
        state.reminders = state.reminders.filter(r => r.id !== id);
        remindersUI.render();
        updateBadges();
        showToast('Lembrete excluído', 'info');
      });
    },
    goToNote(noteId) {
      ui.navigate('notes');
      setTimeout(() => notes.openEditor(null, noteId), 100);
    }
  };

  // ==================== REMINDERS EDITOR ====================
  const reminders = {
    setColor(color) {
      state.currentReminder.color = color;
      document.querySelectorAll('#rem-color-row .color-dot').forEach(b => {
        b.classList.toggle('active', b.dataset.color === color);
      });
    },
    async openEditor(reminderId = null) {
      // Populate notes dropdown
      const select = document.getElementById('rem-note');
      select.innerHTML = '<option value="">Sem nota vinculada</option>' +
        state.notes.map(n => `<option value="${n.id}">${utils.sanitize(n.title)}</option>`).join('');

      if (reminderId) {
        const r = state.reminders.find(r => r.id === reminderId);
        if (!r) return;
        state.currentReminder = { id: r.id, color: r.color || '#6C63FF' };
        document.getElementById('rem-title').value = r.title;
        document.getElementById('rem-description').value = r.description || '';
        const dt = new Date(r.remind_at);
        document.getElementById('rem-date').value = dt.toISOString().split('T')[0];
        document.getElementById('rem-time').value = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
        document.getElementById('rem-repeat').value = r.repeat_type || 'none';
        document.getElementById('rem-priority').value = r.priority || 'normal';
        document.getElementById('rem-note').value = r.note_id || '';
        reminders.setColor(r.color || '#6C63FF');
      } else {
        state.currentReminder = { id: null, color: '#6C63FF' };
        document.getElementById('rem-title').value = '';
        document.getElementById('rem-description').value = '';
        document.getElementById('rem-date').value = utils.todayDateString();
        document.getElementById('rem-time').value = utils.nowTimeString();
        document.getElementById('rem-repeat').value = 'none';
        document.getElementById('rem-priority').value = 'normal';
        document.getElementById('rem-note').value = '';
        reminders.setColor('#6C63FF');
      }

      const modal = document.getElementById('reminder-modal');
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('open'), 10);
    },
    async save() {
      const title = document.getElementById('rem-title').value.trim();
      const date = document.getElementById('rem-date').value;
      const time = document.getElementById('rem-time').value;

      if (!title) { showToast('Adicione um título', 'error'); return; }
      if (!date || !time) { showToast('Defina data e hora', 'error'); return; }

      const remindAt = new Date(`${date}T${time}:00`).toISOString();

      const data = {
        userId: state.user.id,
        title,
        description: document.getElementById('rem-description').value,
        remindAt,
        repeatType: document.getElementById('rem-repeat').value,
        repeatInterval: 1,
        priority: document.getElementById('rem-priority').value,
        color: state.currentReminder.color,
        noteId: document.getElementById('rem-note').value || null
      };

      let result;
      if (state.currentReminder.id) {
        result = await lumina.reminders.update({ id: state.currentReminder.id, ...data });
        const idx = state.reminders.findIndex(r => r.id === state.currentReminder.id);
        if (idx !== -1) state.reminders[idx] = result;
      } else {
        result = await lumina.reminders.create(data);
        state.reminders.push(result);
      }

      ui.closeModal('reminder-modal');
      remindersUI.render();
      updateBadges();
      showToast('Lembrete salvo!', 'success');
    }
  };

  // ==================== CALENDAR ====================
  const calendarUI = {
    async render() {
      const container = document.getElementById('calendar-container');
      const events = await lumina.calendar.getEvents(state.user.id, state.calendarMonth, state.calendarYear);
      state.calendarEvents = events || [];

      const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      const weekdays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
      
      const month = state.calendarMonth - 1;
      const year = state.calendarYear;
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const today = new Date();

      let daysHTML = '';
      // Dias anteriores
      const prevDays = new Date(year, month, 0).getDate();
      for (let i = firstDay - 1; i >= 0; i--) {
        daysHTML += `<div class="cal-day other-month"><div class="cal-day-num">${prevDays - i}</div></div>`;
      }
      // Dias do mês
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const dayEvents = state.calendarEvents.filter(e => e.event_date === dateStr);
        const eventsHTML = dayEvents.slice(0, 3).map(e => `
          <div class="cal-event" style="background:${e.color || '#6C63FF'}" onclick="event.stopPropagation();App.calendar.editEvent('${e.id}')" title="${utils.sanitize(e.title)}">
            ${utils.sanitize(e.title)}
          </div>
        `).join('') + (dayEvents.length > 3 ? `<span class="cal-event-more">+${dayEvents.length - 3}</span>` : '');

        daysHTML += `
          <div class="cal-day ${isToday ? 'today' : ''}" onclick="App.calendar.openEventEditor('${dateStr}')">
            <div class="cal-day-num">${d}</div>
            <div class="cal-events">${eventsHTML}</div>
          </div>
        `;
      }
      // Dias seguintes
      const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
      let nextDay = 1;
      for (let i = firstDay + daysInMonth; i < totalCells; i++, nextDay++) {
        daysHTML += `<div class="cal-day other-month"><div class="cal-day-num">${nextDay}</div></div>`;
      }

      container.innerHTML = `
        <div class="calendar-header">
          <h3 class="cal-month-title">${monthNames[month]} ${year}</h3>
          <div class="cal-nav">
            <button class="cal-nav-btn" onclick="App.calendar.prevMonth()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button class="cal-nav-btn" onclick="App.calendar.today()">Hoje</button>
            <button class="cal-nav-btn" onclick="App.calendar.nextMonth()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </div>
        <div class="calendar-grid">
          <div class="cal-weekdays">
            ${weekdays.map(d => `<div class="cal-weekday">${d}</div>`).join('')}
          </div>
          <div class="cal-days">${daysHTML}</div>
        </div>
      `;
    },
    prevMonth() {
      if (state.calendarMonth === 1) { state.calendarMonth = 12; state.calendarYear--; }
      else state.calendarMonth--;
      calendarUI.render();
    },
    nextMonth() {
      if (state.calendarMonth === 12) { state.calendarMonth = 1; state.calendarYear++; }
      else state.calendarMonth++;
      calendarUI.render();
    },
    today() {
      const now = new Date();
      state.calendarMonth = now.getMonth() + 1;
      state.calendarYear = now.getFullYear();
      calendarUI.render();
    },
    openEventEditor(dateStr = null) {
      state.currentEvent = { id: null };
      document.getElementById('evt-title').value = '';
      document.getElementById('evt-description').value = '';
      document.getElementById('evt-date').value = dateStr || utils.todayDateString();
      document.getElementById('evt-allday').checked = true;
      document.getElementById('evt-time-row').style.display = 'none';
      document.getElementById('evt-start').value = '';
      document.getElementById('evt-end').value = '';
      document.getElementById('evt-color').value = '#6C63FF';

      const modal = document.getElementById('event-modal');
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('open'), 10);
    },
    async editEvent(eventId) {
      const evt = state.calendarEvents.find(e => e.id === eventId);
      if (!evt) return;
      state.currentEvent = { id: eventId };
      document.getElementById('evt-title').value = evt.title;
      document.getElementById('evt-description').value = evt.description || '';
      document.getElementById('evt-date').value = evt.event_date;
      document.getElementById('evt-allday').checked = Boolean(evt.all_day);
      document.getElementById('evt-time-row').style.display = evt.all_day ? 'none' : 'grid';
      document.getElementById('evt-start').value = evt.start_time || '';
      document.getElementById('evt-end').value = evt.end_time || '';
      document.getElementById('evt-color').value = evt.color || '#6C63FF';

      const modal = document.getElementById('event-modal');
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('open'), 10);
    },
    toggleAllDay() {
      const allDay = document.getElementById('evt-allday').checked;
      document.getElementById('evt-time-row').style.display = allDay ? 'none' : 'grid';
    },
    async saveEvent() {
      const title = document.getElementById('evt-title').value.trim();
      if (!title) { showToast('Adicione um título', 'error'); return; }

      const data = {
        userId: state.user.id,
        title,
        description: document.getElementById('evt-description').value,
        eventDate: document.getElementById('evt-date').value,
        color: document.getElementById('evt-color').value,
        allDay: document.getElementById('evt-allday').checked,
        startTime: document.getElementById('evt-start').value || null,
        endTime: document.getElementById('evt-end').value || null
      };

      if (state.currentEvent.id) {
        await lumina.calendar.update({ id: state.currentEvent.id, ...data });
      } else {
        await lumina.calendar.create(data);
      }

      ui.closeModal('event-modal');
      calendarUI.render();
      showToast('Evento salvo!', 'success');
    }
  };

  // ==================== SETTINGS ====================
  const settingsUI = {
    switchTab(tab) {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.toggle('active', c.id === `settings-${tab}`));
    },
    setTheme(theme) {
      document.querySelectorAll('.theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
      if (state.settings) state.settings.theme = theme;
      applySettings({ ...state.settings, theme });
      settingsUI.persist();
    },
    setAccent(color) {
      document.querySelectorAll('.accent-opt').forEach(b => b.classList.toggle('active', b.dataset.color === color));
      if (state.settings) state.settings.accent_color = color;
      applySettings({ ...state.settings, accent_color: color });
      settingsUI.persist();
    },
    setFontSize(size) {
      document.querySelectorAll('.font-size-opt').forEach(b => b.classList.toggle('active', b.dataset.size === size));
      if (state.settings) state.settings.font_size = size;
      applySettings({ ...state.settings, font_size: size });
      settingsUI.persist();
    },
    setAvatarColor(color) {
      document.querySelectorAll('#avatar-colors .accent-opt').forEach(b => b.classList.toggle('active', b.dataset.color === color));
      if (state.user) state.user.avatar_color = color;
      document.getElementById('user-avatar').style.background = color;
    },
    async saveProfile() {
      const displayName = document.getElementById('prof-name').value.trim();
      const email = document.getElementById('prof-email').value.trim();
      const avatarColor = state.user?.avatar_color;

      const result = await lumina.auth.updateProfile({ userId: state.user.id, displayName, email, avatarColor });
      if (result.success) {
        state.user.display_name = displayName;
        state.user.email = email;
        document.getElementById('user-name').textContent = displayName || state.user.username;
        showToast('Perfil atualizado!', 'success');
      } else {
        showToast(result.error || 'Erro ao salvar', 'error');
      }
    },
    async changePassword() {
      const current = document.getElementById('pwd-current').value;
      const newPwd = document.getElementById('pwd-new').value;
      if (!current || !newPwd) { showToast('Preencha os campos', 'error'); return; }
      if (newPwd.length < 6) { showToast('Nova senha muito curta', 'error'); return; }

      const result = await lumina.auth.changePassword({ userId: state.user.id, currentPassword: current, newPassword: newPwd });
      if (result.success) {
        showToast('Senha alterada!', 'success');
        document.getElementById('pwd-current').value = '';
        document.getElementById('pwd-new').value = '';
      } else {
        showToast(result.error || 'Erro ao alterar senha', 'error');
      }
    },
    async persist() {
      if (!state.user || !state.settings) return;
      await lumina.settings.save({
        userId: state.user.id,
        theme: state.settings.theme || 'dark',
        accentColor: state.settings.accent_color || '#6C63FF',
        fontSize: state.settings.font_size || 'medium',
        language: 'pt-BR',
        notificationsEnabled: true,
        soundEnabled: true,
        timelineDirection: 'asc',
        sidebarCollapsed: false,
        data: {}
      });
    }
  };

  // ==================== DATA ====================
  const dataManager = {
    async export() {
      const result = await lumina.data.export(state.user.id);
      if (result.success) {
        showToast('Dados exportados com sucesso!', 'success');
      } else if (!result.canceled) {
        showToast(result.error || 'Erro ao exportar', 'error');
      }
    },
    async import() {
      showConfirm('Importar dados', 'Isso vai adicionar dados do arquivo ao seu perfil atual. Continuar?', async () => {
        const result = await lumina.data.import(state.user.id);
        if (result.success) {
          showToast('Dados importados! Atualizando...', 'success');
          setTimeout(() => ui.loadAll(), 500);
        } else if (!result.canceled) {
          showToast(result.error || 'Erro ao importar', 'error');
        }
      }, false);
    }
  };

  // ==================== EVENT LISTENERS ====================
  function setupListeners() {
    // Search
    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      document.getElementById('search-clear').style.display = e.target.value ? 'flex' : 'none';
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        if (state.searchQuery.length > 1) {
          const results = await lumina.notes.search(state.user?.id, state.searchQuery);
          state.notes = results;
        } else if (!state.searchQuery) {
          await ui.loadAll();
        }
        notes.render();
      }, 300);
    });

    // Note tags input
    document.getElementById('note-tags-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const tag = e.target.value.trim().toLowerCase().replace(/\s+/g, '-');
        if (tag && !state.editorNote.tags.includes(tag)) {
          state.editorNote.tags.push(tag);
          notes.renderTagsEditor();
        }
        e.target.value = '';
      }
    });

    // Auth tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`${tab.dataset.tab}-form`)?.classList.add('active');
      });
    });

    // Enter key on auth forms
    document.getElementById('login-password').addEventListener('keydown', e => {
      if (e.key === 'Enter') auth.login();
    });
    document.getElementById('login-username').addEventListener('keydown', e => {
      if (e.key === 'Enter') auth.login();
    });

    // Ctrl+S to save note
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (document.getElementById('editor-modal').classList.contains('open')) {
          notes.saveNote();
        }
      }
      if (e.key === 'Escape') {
        ui.closeAllPopups();
        if (document.getElementById('confirm-dialog').classList.contains('open')) closeConfirm();
      }
    });

    // Close popups on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.popup-panel') && !e.target.closest('#editor-color-btn') && !e.target.closest('#editor-mood-btn') && !e.target.closest('.mood-opt')) {
        ui.closeAllPopups();
      }
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('open');
          setTimeout(() => { overlay.style.display = 'none'; }, 200);
        }
      });
    });

    // Navigate to note from reminder notification
    if (typeof lumina !== 'undefined' && lumina.on) {
      lumina.on('navigate:note', (noteId) => {
        ui.navigate('notes');
        setTimeout(() => notes.openEditor(null, noteId), 300);
      });
    }
  }

  // ==================== PUBLIC API ====================
  const publicAPI = {
    auth,
    notes,
    diary,
    reminders,
    remindersUI,
    calendar: calendarUI,
    settings: settingsUI,
    data: dataManager,
    ui,
    showToast,
    state
  };

  // ==================== INIT ====================
  async function init() {
    setupListeners();
    await auth.init();
  }

  document.addEventListener('DOMContentLoaded', init);

  return publicAPI;
})();

// Helper global
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}
