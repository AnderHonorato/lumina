const { contextBridge, ipcRenderer } = require('electron');

const listeners = new Map();
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('lumina', {
  platform: { kind: 'electron', isNative: true, ready: async () => true },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    hideToTray: () => ipcRenderer.send('window:hide-to-tray'),
    quit: () => ipcRenderer.send('window:confirm-quit')
  },
  auth: {
    register: data => invoke('auth:register', data),
    login: data => {
      const remember = data?.remember ?? Boolean(document.getElementById('login-remember')?.checked);
      return invoke('auth:login', { ...data, remember });
    },
    getUsers: () => invoke('auth:getUsers'),
    updateProfile: data => invoke('auth:updateProfile', data),
    changePassword: data => invoke('auth:changePassword', data),
    updateAvatar: data => invoke('auth:updateAvatar', data),
    getSession: () => invoke('auth:getSession'),
    clearSession: () => invoke('auth:clearSession')
  },
  notes: {
    getAll: userId => invoke('notes:getAll', userId), getOne: id => invoke('notes:getOne', id),
    create: data => invoke('notes:create', data), update: data => invoke('notes:update', data),
    delete: id => invoke('notes:delete', id), deleteMultiple: (userId, ids) => invoke('notes:deleteMultiple', { userId, ids }),
    getHistory: userId => invoke('notes:getHistory', userId), search: (userId, query) => invoke('notes:search', { userId, query }),
    getTags: userId => invoke('notes:getTags', userId)
  },
  reminders: {
    getAll: userId => invoke('reminders:getAll', userId), create: data => invoke('reminders:create', data),
    update: data => invoke('reminders:update', data), delete: id => invoke('reminders:delete', id), complete: id => invoke('reminders:complete', id)
  },
  calendar: {
    getEvents: (userId, month, year) => invoke('calendar:getEvents', { userId, month, year }),
    create: data => invoke('calendar:create', data), update: data => invoke('calendar:update', data), delete: id => invoke('calendar:delete', id)
  },
  demands: {
    getAll: userId => invoke('demands:getAll', userId), getOne: id => invoke('demands:getOne', id),
    create: data => invoke('demands:create', data), update: data => invoke('demands:update', data), delete: id => invoke('demands:delete', id)
  },
  chat: {
    getConversations: userId => invoke('chat:getConversations', userId), getConversation: id => invoke('chat:getConversation', id),
    createConversation: data => invoke('chat:createConversation', data), deleteConversation: (id, userId) => invoke('chat:deleteConversation', id, userId),
    updateConversation: data => invoke('chat:updateConversation', data), addMessage: data => invoke('chat:addMessage', data),
    getHistory: conversationId => invoke('chat:getHistory', conversationId)
  },
  network: {
    start: userInfo => invoke('network:start', userInfo), getPeers: () => invoke('network:getPeers'),
    sendToPeer: (host, data) => invoke('network:sendToPeer', { host, data })
  },
  users: {
    sendMessage: data => invoke('users:sendMessage', data), getMessages: (userId, otherUserId) => invoke('users:getMessages', { userId, otherUserId }),
    getConversations: userId => invoke('users:getConversations', userId), deleteMessage: id => invoke('users:deleteMessage', id),
    blockUser: (fromId, toId) => invoke('users:blockUser', { userId: fromId, blockUserId: toId }),
    archiveChat: (fromId, toId) => invoke('users:archiveChat', { userId: fromId, otherUserId: toId }),
    shareItem: data => invoke('users:shareItem', data), getSharedItems: userId => invoke('users:getSharedItems', userId)
  },
  files: {
    save: data => invoke('files:save', data), getPath: data => invoke('files:getPath', data), delete: filePath => invoke('files:delete', filePath),
    open: filePath => invoke('files:open', filePath), readAsBase64: filePath => invoke('files:readAsBase64', filePath)
  },
  dialog: { openFile: options => invoke('dialog:openFile', options), saveFile: options => invoke('dialog:saveFile', options) },
  data: { export: userId => invoke('data:export', userId), import: userId => invoke('data:import', userId) },
  settings: { get: userId => invoke('settings:get', userId), save: data => invoke('settings:save', data) },
  secrets: {
    setApiKey: value => invoke('secrets:set', { key: 'ai-api-key', value }),
    getApiKey: () => invoke('secrets:get', { key: 'ai-api-key' }),
    removeApiKey: () => invoke('secrets:remove', { key: 'ai-api-key' })
  },
  ai: {
    refine: async (text, apiKey) => {
      const secure = await invoke('secrets:get', { key: 'ai-api-key' }).catch(() => ({ success: false }));
      return invoke('ai:refine', { text, apiKey: secure?.value || apiKey || '' });
    },
    chat: async (messages, apiKey) => {
      const secure = await invoke('secrets:get', { key: 'ai-api-key' }).catch(() => ({ success: false }));
      return invoke('ai:chat', { messages, apiKey: secure?.value || apiKey || '' });
    }
  },
  reminder: { openNote: noteId => ipcRenderer.send('reminder:openNote', noteId), dismiss: reminderId => ipcRenderer.send('reminder:dismiss', reminderId) },
  on: (channel, callback) => {
    const valid = ['navigate:note','reminder:trigger','window:ask-close-tray','network:peer-found','network:message'];
    if (!valid.includes(channel) || typeof callback !== 'function') return;
    const wrapped = (_, ...args) => callback(...args);
    if (!listeners.has(channel)) listeners.set(channel, new Map());
    listeners.get(channel).set(callback, wrapped);
    ipcRenderer.on(channel, wrapped);
  },
  off: (channel, callback) => {
    const wrapped = listeners.get(channel)?.get(callback);
    if (wrapped) { ipcRenderer.removeListener(channel, wrapped); listeners.get(channel).delete(callback); }
  }
});
