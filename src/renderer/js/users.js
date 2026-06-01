// Users module - loaded after app.js, patches onto App
(function() {
  if (typeof App === 'undefined') { setTimeout(arguments.callee, 100); return; }

  App.users = {
    otherUserId: null,
    otherUser: null,
    render() {
      const list = document.getElementById('users-list');
      const empty = document.getElementById('users-empty');
      const all = App.state.allUsers || [];
      const others = all.filter(u => u.id !== App.state.user?.id);
      if (others.length === 0) { empty.style.display = 'flex'; list.innerHTML = ''; return; }
      empty.style.display = 'none';
      list.innerHTML = others.map(u => {
        const hasPhoto = u.avatar_photo;
        return '<div class="user-card" onclick="App.users.openChat(\''+u.id+'\')">'+
          '<div class="user-card-avatar" style="'+(hasPhoto?'background-image:url('+u.avatar_photo+');background-size:cover':'background:'+(u.avatar_color||'var(--accent)'))+'">'+(hasPhoto?'':(u.display_name||u.username)[0].toUpperCase())+'</div>'+
          '<div class="user-card-info">'+
          '<span class="user-card-name">'+(u.display_name||u.username).replace(/</g,'&lt;')+'</span>'+
          '<span class="user-card-handle">@'+(u.username||'').replace(/</g,'&lt;')+'</span>'+
          (u.bio?'<span class="user-card-bio">'+(u.bio).replace(/</g,'&lt;')+'</span>':'')+
          (u.city?'<span class="user-card-loc">📍 '+(u.city).replace(/</g,'&lt;')+(u.state?'/'+(u.state).replace(/</g,'&lt;'):'')+'</span>':'')+
          '</div></div>';
      }).join('');
    },
    async openChat(userId) {
      App.users.otherUserId = userId;
      const all = App.state.allUsers || [];
      App.users.otherUser = all.find(u => u.id === userId);
      document.getElementById('user-chat-name').textContent = App.users.otherUser?.display_name || App.users.otherUser?.username || 'Usuário';
      const avatar = document.getElementById('user-chat-avatar');
      const hasPhoto = App.users.otherUser?.avatar_photo;
      avatar.style.cssText = hasPhoto ? 'background-image:url('+App.users.otherUser.avatar_photo+');background-size:cover' : 'background:'+(App.users.otherUser?.avatar_color||'var(--accent)');
      avatar.textContent = hasPhoto ? '' : ((App.users.otherUser?.display_name||'U')[0].toUpperCase());
      await App.users.loadMessages();
      const modal = document.getElementById('user-chat-modal');
      modal.style.display = 'flex';
      setTimeout(function(){ modal.classList.add('open'); }, 10);
    },
    async loadMessages() {
      if (!App.users.otherUserId) return;
      const msgs = await lumina.users.getMessages(App.state.user.id, App.users.otherUserId);
      const container = document.getElementById('user-chat-messages');
      if (!msgs || msgs.length === 0) { container.innerHTML = '<p style="text-align:center;color:var(--text-3);padding:20px">Nenhuma mensagem ainda</p>'; return; }
      container.innerHTML = msgs.map(function(m) {
        const isMe = m.from_user_id === App.state.user.id;
        const time = new Date(m.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
        let content = '';
        if (m.file_data) {
          if (m.file_type && m.file_type.startsWith('image/')) content = '<img src="'+m.file_data+'" style="max-width:200px;max-height:200px;border-radius:8px">';
          else if (m.file_type && m.file_type.startsWith('video/')) content = '<video src="'+m.file_data+'" controls style="max-width:200px;border-radius:8px"></video>';
          else if (m.file_type && m.file_type.startsWith('audio/')) content = '<audio src="'+m.file_data+'" controls></audio>';
          else content = '<div style="display:flex;align-items:center;gap:6px;padding:8px;background:var(--surface-2);border-radius:6px">📎 '+(m.file_name||'Arquivo').replace(/</g,'&lt;')+'</div>';
        }
        if (m.content) content += '<span>'+(m.content||'').replace(/</g,'&lt;')+'</span>';
        return '<div class="chat-msg '+(isMe?'user':'assistant')+'" style="max-width:80%">'+
          '<div class="chat-msg-content">'+
          '<div class="chat-msg-text" style="'+(isMe?'background:var(--accent);color:#fff;padding:8px 12px;border-radius:12px;border-bottom-right-radius:4px':'background:var(--surface);border:1px solid var(--border);padding:8px 12px;border-radius:12px;border-bottom-left-radius:4px')+'">'+content+'</div>'+
          '<div class="chat-msg-time" style="text-align:'+(isMe?'right':'left')+'">'+time+'</div>'+
          '</div></div>';
      }).join('');
      container.scrollTop = container.scrollHeight;
    },
    sendMessage: async function() {
      const input = document.getElementById('user-chat-input');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      input.style.height = 'auto';
      await lumina.users.sendMessage({ fromUserId: App.state.user.id, toUserId: App.users.otherUserId, content: text });
      await App.users.loadMessages();
    },
    handleFile: async function(event) {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 10*1024*1024) { App.showToast('Arquivo muito grande (max 10MB)', 'error'); return; }
      const reader = new FileReader();
      reader.onload = async function(e) {
        await lumina.users.sendMessage({ fromUserId: App.state.user.id, toUserId: App.users.otherUserId, content: '', fileName: file.name, fileData: e.target.result, fileType: file.type });
        await App.users.loadMessages();
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    },
    blockChat: async function() {
      App.showConfirm('Bloquear', 'Bloquear este usuário?', async function() {
        await lumina.users.blockUser(App.state.user.id, App.users.otherUserId);
        App.ui.closeModal('user-chat-modal');
        App.showToast('Usuário bloqueado', 'info');
      });
    },
    archiveChat: async function() {
      await lumina.users.archiveChat(App.state.user.id, App.users.otherUserId);
      App.ui.closeModal('user-chat-modal');
      App.showToast('Chat arquivado', 'info');
    },
    shareNote: async function() {
      const notes = App.state.notes || [];
      if (!notes.length) { App.showToast('Nenhuma nota para compartilhar', 'error'); return; }
      const note = notes[0];
      await lumina.users.shareItem({ fromUserId: App.state.user.id, toUserId: App.users.otherUserId, itemType: 'note', itemData: JSON.stringify(note) });
      App.showToast('Nota compartilhada!', 'success');
    }
  };

  // Patch navigate to include users page
  const origNavigate = App.ui.navigate;
  App.ui.navigate = function(page) {
    origNavigate(page);
    if (page === 'users') App.users.render();
  };

  console.log('[Lumina] Users module loaded');
})();
