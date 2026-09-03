/* Lumina Notes - experiência móvel progressiva sobre o renderer existente. */
(() => {
  if (!window.Capacitor?.isNativePlatform?.()) return;

  const $ = (s, root = document) => root.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = (name, size = 22) => {
    const paths = {
      home:'<path d="M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z"/>',
      book:'<path d="M3 4h6a4 4 0 0 1 4 4v13a4 4 0 0 0-4-4H3z"/><path d="M21 4h-6a4 4 0 0 0-4 4v13a4 4 0 0 1 4-4h6z"/>',
      plus:'<path d="M12 5v14M5 12h14"/>',
      calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
      user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      note:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
      bell:'<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
      briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18"/>',
      search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      trash:'<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
      alarm:'<circle cx="12" cy="13" r="7"/><path d="M12 9v4l3 2M5 3 2 6M19 3l3 3"/>',
      share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
      edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
      close:'<path d="m6 6 12 12M18 6 6 18"/>',
      location:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
      chevron:'<path d="m9 18 6-6-6-6"/>'
    };
    return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.note}</svg>`;
  };

  let originalOpenEditor, autosaveTimer, readerNoteId = null;

  function addStylesAndShell() {
    if ($('#mobile-bottom-nav')) return;
    document.body.classList.add('mobile-runtime-ready');
    document.body.insertAdjacentHTML('beforeend', `
      <nav id="mobile-bottom-nav" class="mobile-bottom-nav" aria-label="Navegação principal">
        <button data-mobile-page="notes" class="active">${icon('home')}<span>Início</span></button>
        <button data-mobile-page="diary">${icon('book')}<span>Diário</span></button>
        <button id="mobile-create" class="mobile-create" aria-label="Criar">${icon('plus',26)}</button>
        <button data-mobile-page="calendar">${icon('calendar')}<span>Calendário</span></button>
        <button id="mobile-profile">${icon('user')}<span>Perfil</span></button>
      </nav>
      <div id="mobile-action-sheet" class="mobile-sheet-backdrop" hidden>
        <section class="mobile-sheet" role="dialog" aria-modal="true" aria-labelledby="create-title">
          <div class="mobile-sheet-handle"></div><h2 id="create-title">Criar no Lumina</h2>
          <div class="mobile-create-grid">
            <button data-create="note">${icon('note')}<span>Nova nota</span></button>
            <button data-create="diary">${icon('book')}<span>Diário</span></button>
            <button data-create="reminder">${icon('bell')}<span>Lembrete</span></button>
            <button data-create="event">${icon('calendar')}<span>Evento</span></button>
            <button data-create="demand">${icon('briefcase')}<span>Demanda</span></button>
          </div>
          <div class="mobile-secondary-actions">
            <button data-tool="search">${icon('search')} Busca global</button>
            <button data-tool="alarms">${icon('alarm')} Alarmes</button>
            <button data-tool="trash">${icon('trash')} Lixeira</button>
          </div>
        </section>
      </div>
      <div id="mobile-reader" class="mobile-reader" hidden></div>
      <div id="mobile-tool-overlay" class="mobile-tool-overlay" hidden></div>
      <div id="mobile-loading" class="mobile-loading" aria-live="polite"><div class="lumina-mark"><i></i><b></b></div><strong>Lumina</strong><span>Preparando seu espaço…</span></div>
    `);

    document.querySelectorAll('[data-mobile-page]').forEach(btn => btn.addEventListener('click', () => {
      App.ui.navigate(btn.dataset.mobilePage); setActiveNav(btn.dataset.mobilePage); lumina.native?.haptic?.();
    }));
    $('#mobile-profile').addEventListener('click', () => { App.ui.showSettings(); setActiveNav('profile'); });
    $('#mobile-create').addEventListener('click', () => toggleSheet(true));
    $('#mobile-action-sheet').addEventListener('click', e => { if (e.target === e.currentTarget) toggleSheet(false); });
    document.querySelectorAll('[data-create]').forEach(btn => btn.addEventListener('click', () => createAction(btn.dataset.create)));
    document.querySelectorAll('[data-tool]').forEach(btn => btn.addEventListener('click', () => { toggleSheet(false); openTool(btn.dataset.tool); }));
  }

  function setActiveNav(page) {
    document.querySelectorAll('#mobile-bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.mobilePage === page || (page === 'profile' && b.id === 'mobile-profile')));
  }
  function toggleSheet(show) { const el=$('#mobile-action-sheet'); el.hidden=!show; requestAnimationFrame(()=>el.classList.toggle('open',show)); }
  function createAction(kind) {
    toggleSheet(false);
    if (kind === 'note') originalOpenEditor?.('note');
    if (kind === 'diary') originalOpenEditor?.('diary');
    if (kind === 'reminder') App.reminders?.openEditor?.();
    if (kind === 'event') App.calendar?.openEventEditor?.();
    if (kind === 'demand') App.demands?.openEditor?.();
  }

  function markdownSeguro(text) {
    let s = esc(text || '');
    s = s.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>');
    s = s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/__(.+?)__/g,'<u>$1</u>').replace(/~~(.+?)~~/g,'<s>$1</s>').replace(/\*(.+?)\*/g,'<em>$1</em>');
    s = s.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>').replace(/^- \[x\] (.+)$/gim,'<div class="reader-check done">✓ $1</div>').replace(/^- \[ \] (.+)$/gm,'<div class="reader-check">□ $1</div>').replace(/^- (.+)$/gm,'<div class="reader-list">• $1</div>');
    return s.split(/\n{2,}/).map(p => /^(<h|<block|<div)/.test(p) ? p : `<p>${p.replace(/\n/g,'<br>')}</p>`).join('');
  }

  function showReader(noteId) {
    const note = App.state.notes.find(n => n.id === noteId); if (!note) return originalOpenEditor?.(null,noteId);
    readerNoteId = noteId;
    const reader = $('#mobile-reader');
    const tags=(note.tags||[]).map(t=>`<span>#${esc(t)}</span>`).join('');
    const mood = note.mood ? `<span class="reader-mood">${esc(note.mood)}</span>` : '';
    reader.innerHTML = `<header><button id="reader-close" aria-label="Fechar">${icon('close')}</button><div class="reader-actions"><button id="reader-share">${icon('share')}<span>Compartilhar</span></button><button id="reader-edit">${icon('edit')}<span>Editar</span></button></div></header>
      <article><div class="reader-kicker">${note.type === 'diary' ? 'Diário' : 'Anotação'} · ${new Date(note.updated_at||note.created_at).toLocaleDateString('pt-BR')}</div><h1>${esc(note.title||'Sem título')}</h1><div class="reader-meta">${mood}${tags}</div><div class="reader-body">${markdownSeguro(note.content)}</div>${renderReaderAttachments(note.attachments||[])}</article>`;
    reader.hidden=false; requestAnimationFrame(()=>reader.classList.add('open'));
    $('#reader-close').onclick=closeReader;
    $('#reader-edit').onclick=()=>{ closeReader(); originalOpenEditor?.(null,noteId); prepareEditor(); };
    $('#reader-share').onclick=async()=>{await lumina.native.shareNote(note);App.showToast('Menu de compartilhamento aberto','success');};
  }
  function closeReader(){const r=$('#mobile-reader');r.classList.remove('open');setTimeout(()=>r.hidden=true,180);readerNoteId=null;}
  function renderReaderAttachments(atts){ if(!atts.length)return'';return `<section class="reader-attachments"><h2>Anexos</h2>${atts.map(a=>`<div class="reader-attachment">${icon('note')}<div><strong>${esc(a.originalName||a.name||'Arquivo')}</strong><span>${esc((a.type||'arquivo').toUpperCase())}</span></div></div>`).join('')}</section>`; }

  function patchAuth() {
    App.auth.login = async function() {
      const username=$('#login-username')?.value.trim(), password=$('#login-password')?.value, remember=Boolean($('#login-remember')?.checked), err=$('#login-error');
      if(err)err.textContent=''; if(!username||!password){if(err)err.textContent='Preencha todos os campos';return;}
      const result=await lumina.auth.login({username,password,remember});
      if(result.success) await App.auth.afterLogin(result.user); else if(err)err.textContent=result.error||'Erro ao entrar';
    };
    const originalLogout=App.auth.logout.bind(App.auth);
    App.auth.logout=function(){ App.showConfirm('Sair','Deseja sair da conta?',async()=>{await lumina.auth.clearSession();App.state.user=null;App.state.notes=[];App.state.reminders=[];$('#main-screen')?.classList.remove('active');$('#auth-screen')?.classList.add('active');if($('#login-password'))$('#login-password').value='';App.auth.init();}); };
    void originalLogout;
  }

  function prepareEditor() {
    const modal=$('#editor-modal'); if(!modal)return;
    let toolbar=$('#mobile-rich-toolbar');
    if(!toolbar){
      toolbar=document.createElement('div');toolbar.id='mobile-rich-toolbar';toolbar.className='mobile-rich-toolbar';
      toolbar.innerHTML=['H1','H2','H3','B','I','U','S','☑','❝','</>','↶','↷'].map((x,i)=>`<button type="button" data-format="${i}" aria-label="Formatar ${esc(x)}">${esc(x)}</button>`).join('')+`<span id="mobile-save-state">Salvo</span>`;
      const content=$('#note-content');content?.parentNode?.insertBefore(toolbar,content);
      toolbar.addEventListener('click',e=>{const b=e.target.closest('button');if(b)applyFormat(Number(b.dataset.format));});
    }
    const title=$('#note-title'),content=$('#note-content');
    [title,content].forEach(el=>{if(!el||el.dataset.autosaveBound)return;el.dataset.autosaveBound='1';el.addEventListener('input',scheduleAutosave);});
    if(content) content.setAttribute('placeholder','Escreva livremente. Use a barra para estruturar o texto…');
  }
  function applyFormat(i){const el=$('#note-content');if(!el)return;const a=el.selectionStart,b=el.selectionEnd,sel=el.value.slice(a,b);const pairs=[['# ',''],['## ',''],['### ',''],['**','**'],['*','*'],['__','__'],['~~','~~'],['- [ ] ',''],['> ',''],['`','`']];if(i===10){document.execCommand?.('undo');return;}if(i===11){document.execCommand?.('redo');return;}const [pre,post]=pairs[i]||['',''];el.setRangeText(pre+sel+post,a,b,'end');el.dispatchEvent(new Event('input',{bubbles:true}));el.focus();}
  function scheduleAutosave(){clearTimeout(autosaveTimer);const state=$('#mobile-save-state');if(state)state.textContent='Salvando…';autosaveTimer=setTimeout(async()=>{try{await App.notes.saveNote();if(state)state.textContent='Salvo';}catch{if(state)state.textContent='Não salvo';}},900);}

  function patchNotes() {
    originalOpenEditor=App.notes.openEditor.bind(App.notes);
    App.notes.openEditor=function(type=null,noteId=null){if(noteId){showReader(noteId);return;}originalOpenEditor(type,noteId);prepareEditor();};
    App.notes.attachFile=function(){
      const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,*/*';
      input.onchange=async()=>{for(const file of [...input.files]){if(file.size>40*1024*1024){App.showToast(`${file.name}: limite de 40 MB`,'error');continue;}const data=await fileToBase64(file);const saved=await lumina.files.save({fileName:file.name,data,userId:App.state.user.id});if(saved.success)App.state.editorNote.attachments.push({originalName:file.name,savedName:saved.savedName,path:saved.path,nativePath:saved.path,type:mimeKind(file.type,file.name),size:file.size});}renderMobileAttachments();scheduleAutosave();};
      input.click();
    };
    App.notes.renderAttachments=renderMobileAttachments;
  }
  function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=reject;r.readAsDataURL(file);});}
  function mimeKind(mime,name){if(mime.startsWith('image/'))return'image';if(mime.startsWith('video/'))return'video';if(mime.startsWith('audio/'))return'audio';if(/\.pdf$/i.test(name))return'pdf';return'file';}
  function renderMobileAttachments(){const area=$('#attachments-area');if(!area)return;area.innerHTML=(App.state.editorNote.attachments||[]).map((a,i)=>`<button type="button" class="attachment-item mobile-attachment" data-index="${i}">${icon('note')}<span class="attachment-name">${esc(a.originalName)}</span><span class="attachment-size">${a.size?Math.round(a.size/1024)+' KB':esc(a.type||'arquivo')}</span><i class="attachment-remove" data-remove="${i}">${icon('close',14)}</i></button>`).join('');area.querySelectorAll('[data-remove]').forEach(b=>b.onclick=e=>{e.stopPropagation();App.notes.removeAttachment(Number(b.dataset.remove));});}

  function patchSettings() {
    const originalShow=App.ui.showSettings.bind(App.ui);
    App.ui.showSettings=function(){originalShow();ensureProfileFields();populateProfileFields();};
    App.settings.saveProfile=async function(){const d={userId:App.state.user.id,displayName:$('#prof-name')?.value.trim(),email:$('#prof-email')?.value.trim(),avatarColor:App.state.user?.avatar_color,bio:$('#prof-bio')?.value||'',city:$('#prof-city')?.value||'',state:$('#prof-state')?.value||'',birthday:$('#prof-birthday')?.value||'',country:$('#prof-country')?.value||'',zipCode:$('#prof-zip')?.value||'',address:$('#prof-address')?.value||'',latitude:numOrNull($('#prof-lat')?.value),longitude:numOrNull($('#prof-lon')?.value)};const r=await lumina.auth.updateProfile(d);if(r.success){Object.assign(App.state.user,r.user||d);$('#user-name').textContent=d.displayName||App.state.user.username;App.showToast('Perfil atualizado!','success');}else App.showToast(r.error||'Erro ao salvar','error');};
    App.settings.saveApiKey=async function(){const value=$('#api-key-input')?.value.trim();if(!value){App.showToast('Digite sua chave de API','error');return;}const r=await lumina.secrets.setApiKey(value);if(r.success){$('#api-key-input').value='';$('#api-key-input').placeholder='Chave protegida no Android';App.showToast('Chave salva no armazenamento seguro','success');}else App.showToast(r.error||'Não foi possível proteger a chave','error');};
  }
  function numOrNull(v){const n=Number(v);return Number.isFinite(n)?n:null;}
  function ensureProfileFields(){const birthday=$('#prof-birthday')?.closest('.form-group');if(!birthday||$('#prof-country'))return;birthday.insertAdjacentHTML('afterend',`<div class="mobile-profile-extra"><div class="form-row"><div class="form-group"><label class="form-label">País</label><input id="prof-country" class="form-input" autocomplete="country-name"></div><div class="form-group"><label class="form-label">CEP</label><input id="prof-zip" class="form-input" inputmode="numeric" autocomplete="postal-code"></div></div><div class="form-group"><label class="form-label">Endereço / localização</label><input id="prof-address" class="form-input" placeholder="Editável manualmente"></div><input id="prof-lat" type="hidden"><input id="prof-lon" type="hidden"><button type="button" id="profile-current-location" class="btn-secondary">${icon('location',18)} Usar localização atual</button><p class="settings-desc">A localização só é solicitada quando você tocar neste botão.</p></div>`);$('#profile-current-location').onclick=useCurrentLocation;}
  async function useCurrentLocation(){const btn=$('#profile-current-location');btn.disabled=true;btn.textContent='Obtendo localização…';const r=await lumina.native.location();btn.disabled=false;btn.innerHTML=`${icon('location',18)} Usar localização atual`;if(!r.success){App.showToast(r.error||'Localização indisponível','error');return;}$('#prof-lat').value=r.latitude;$('#prof-lon').value=r.longitude;App.showToast('Coordenadas preenchidas. Você pode editar o endereço.','success');}
  function populateProfileFields(){ensureProfileFields();const u=App.state.user||{};for(const [id,key] of [['prof-bio','bio'],['prof-city','city'],['prof-state','state'],['prof-birthday','birthday'],['prof-country','country'],['prof-zip','zip_code'],['prof-address','address'],['prof-lat','latitude'],['prof-lon','longitude']]){const el=$('#'+id);if(el)el.value=u[key]??'';}}

  function openTool(kind){if(kind==='search')return searchTool();if(kind==='trash')return trashTool();if(kind==='alarms')return alarmsTool();}
  function toolShell(title,body){const ov=$('#mobile-tool-overlay');ov.innerHTML=`<section class="mobile-tool"><header><button id="tool-close">${icon('close')}</button><h2>${esc(title)}</h2></header>${body}</section>`;ov.hidden=false;requestAnimationFrame(()=>ov.classList.add('open'));$('#tool-close').onclick=()=>{ov.classList.remove('open');setTimeout(()=>ov.hidden=true,180);};return ov;}
  function searchTool(){const ov=toolShell('Busca global',`<div class="mobile-search-box">${icon('search',18)}<input id="global-search-input" type="search" placeholder="Notas, lembretes, eventos, demandas…" autofocus></div><div id="global-search-results" class="mobile-tool-list"><p>Digite pelo menos 2 caracteres.</p></div>`);let timer;$('#global-search-input',ov).oninput=e=>{clearTimeout(timer);timer=setTimeout(async()=>{const q=e.target.value.trim(),out=$('#global-search-results',ov);if(q.length<2){out.innerHTML='<p>Digite pelo menos 2 caracteres.</p>';return;}const rows=await lumina.search.global(App.state.user.id,q);out.innerHTML=rows.length?rows.map(r=>`<button class="tool-row"><span class="tool-kind">${esc(r.kind)}</span><strong>${esc(r.title)}</strong><small>${esc((r.content||'').slice(0,100))}</small></button>`).join(''):'<p>Nada encontrado.</p>';},250);};}
  async function trashTool(){const rows=await lumina.notes.getHistory(App.state.user.id);const ov=toolShell('Lixeira',`<div id="trash-list" class="mobile-tool-list">${rows.length?rows.map(r=>`<div class="tool-row"><div><strong>${esc(r.title)}</strong><small>Excluída ${new Date(r.deleted_at).toLocaleString('pt-BR')}</small></div><div class="row-actions"><button data-restore="${r.id}">Restaurar</button><button class="danger" data-purge="${r.id}">Apagar</button></div></div>`).join(''):'<p>A lixeira está vazia.</p>'}</div>`);ov.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{await lumina.notes.restore(b.dataset.restore);await App.ui.loadAll();trashTool();});ov.querySelectorAll('[data-purge]').forEach(b=>b.onclick=()=>App.showConfirm('Excluir definitivamente','Esta ação não pode ser desfeita.',async()=>{await lumina.notes.purge(b.dataset.purge);trashTool();}));}
  async function alarmsTool(){const rows=await lumina.alarms.getAll(App.state.user.id);const ov=toolShell('Alarmes',`<button id="new-alarm" class="tool-primary">${icon('plus',18)} Novo alarme</button><div class="mobile-tool-list">${rows.length?rows.map(a=>`<div class="tool-row"><div><strong>${esc(a.title)}</strong><small>${new Date(a.alarm_time).toLocaleString('pt-BR')}</small></div><button class="danger" data-alarm-delete="${a.id}">Excluir</button></div>`).join(''):'<p>Nenhum alarme criado.</p>'}</div>`);$('#new-alarm',ov).onclick=alarmForm;ov.querySelectorAll('[data-alarm-delete]').forEach(b=>b.onclick=async()=>{await lumina.alarms.delete(b.dataset.alarmDelete);alarmsTool();});}
  function alarmForm(){const ov=toolShell('Novo alarme',`<form id="alarm-form" class="mobile-form"><label>Título<input id="alarm-title" required placeholder="Acordar, medicamento, tarefa…"></label><label>Data e hora<input id="alarm-time" type="datetime-local" required></label><label>Soneca (min)<input id="alarm-snooze" type="number" min="1" max="60" value="10"></label><label class="form-check"><input id="alarm-vibrate" type="checkbox" checked> Vibrar</label><button class="tool-primary" type="submit">Salvar alarme</button></form>`);$('#alarm-form',ov).onsubmit=async e=>{e.preventDefault();const dt=$('#alarm-time',ov).value;if(!dt)return;await lumina.alarms.create({userId:App.state.user.id,title:$('#alarm-title',ov).value.trim()||'Alarme',alarmTime:new Date(dt).toISOString(),repeatDays:[],vibrate:$('#alarm-vibrate',ov).checked,snoozeMinutes:Number($('#alarm-snooze',ov).value)||10,enabled:true});App.showToast('Alarme agendado','success');alarmsTool();};}

  async function onboarding() {
    const Pref=window.Capacitor.Plugins?.Preferences; if(!Pref)return;
    const seen=await Pref.get({key:'lumina_onboarding_v2'}); if(seen.value==='done')return;
    const el=document.createElement('div');el.className='mobile-onboarding';el.innerHTML=`<div class="onboarding-mark"><div class="lumina-mark"><i></i><b></b></div><span>Lumina Notes</span></div><div class="onboarding-copy"><span>Seu espaço pessoal, agora no Android</span><h1>Ideias, memórias e planos em um só lugar.</h1><p>Funciona offline, guarda seus dados localmente e usa recursos do celular apenas quando você pedir.</p><div class="onboarding-benefits"><div>${icon('note')}<b>Anotações e diário</b><small>Escreva, organize, anexe e recupere versões.</small></div><div>${icon('bell')}<b>Lembretes reais</b><small>Notificações Android mesmo fora do app.</small></div><div>${icon('share')}<b>Compartilhamento nativo</b><small>Envie conteúdo para os apps instalados.</small></div></div></div><button id="onboarding-start">Começar ${icon('chevron',18)}</button>`;document.body.appendChild(el);$('#onboarding-start',el).onclick=async()=>{await Pref.set({key:'lumina_onboarding_v2',value:'done'});el.classList.add('leaving');setTimeout(()=>el.remove(),320);};
  }

  async function restoreSession() {
    try { await lumina.platform.ready(); const r=await lumina.auth.getSession(); if(r.success&&!App.state.user)await App.auth.afterLogin(r.user); } catch(e){console.error(e);} finally { const l=$('#mobile-loading');if(l){l.classList.add('done');setTimeout(()=>l.remove(),300);} }
  }

  function boot() {
    addStylesAndShell(); patchAuth(); patchNotes(); patchSettings(); prepareEditor(); onboarding(); restoreSession();
    const originalNavigate=App.ui.navigate.bind(App.ui);App.ui.navigate=function(page){originalNavigate(page);setActiveNav(page);};
    document.addEventListener('backbutton',()=>{if(!$('#mobile-reader')?.hidden)return closeReader();if(!$('#mobile-tool-overlay')?.hidden){$('#tool-close')?.click();return;}if(!$('#mobile-action-sheet')?.hidden){toggleSheet(false);return;}},false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
