const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lumina', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    hideToTray: () => ipcRenderer.send('window:hide-to-tray'),
    quit: () => ipcRenderer.send('window:confirm-quit'),
  },
  
  // Auth
  auth: {
    register: (data) => ipcRenderer.invoke('auth:register', data),
    login: (data) => ipcRenderer.invoke('auth:login', data),
    getUsers: () => ipcRenderer.invoke('auth:getUsers'),
    updateProfile: (data) => ipcRenderer.invoke('auth:updateProfile', data),
    changePassword: (data) => ipcRenderer.invoke('auth:changePassword', data),
    updateAvatar: (data) => ipcRenderer.invoke('auth:updateAvatar', data),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
    clearSession: () => ipcRenderer.invoke('auth:clearSession'),
  },
  
  // Notes
  notes: {
    getAll: (userId) => ipcRenderer.invoke('notes:getAll', userId),
    getOne: (id) => ipcRenderer.invoke('notes:getOne', id),
    create: (data) => ipcRenderer.invoke('notes:create', data),
    update: (data) => ipcRenderer.invoke('notes:update', data),
    delete: (id) => ipcRenderer.invoke('notes:delete', id),
    deleteMultiple: (userId, ids) => ipcRenderer.invoke('notes:deleteMultiple', { userId, ids }),
    getHistory: (userId) => ipcRenderer.invoke('notes:getHistory', userId),
    search: (userId, query) => ipcRenderer.invoke('notes:search', { userId, query }),
    getTags: (userId) => ipcRenderer.invoke('notes:getTags', userId),
  },
  
  // Reminders
  reminders: {
    getAll: (userId) => ipcRenderer.invoke('reminders:getAll', userId),
    create: (data) => ipcRenderer.invoke('reminders:create', data),
    update: (data) => ipcRenderer.invoke('reminders:update', data),
    delete: (id) => ipcRenderer.invoke('reminders:delete', id),
    complete: (id) => ipcRenderer.invoke('reminders:complete', id),
  },
  
  // Calendar
  calendar: {
    getEvents: (userId, month, year) => ipcRenderer.invoke('calendar:getEvents', { userId, month, year }),
    create: (data) => ipcRenderer.invoke('calendar:create', data),
    update: (data) => ipcRenderer.invoke('calendar:update', data),
    delete: (id) => ipcRenderer.invoke('calendar:delete', id),
  },

  // Demands
  demands: {
    getAll: (userId) => ipcRenderer.invoke('demands:getAll', userId),
    getOne: (id) => ipcRenderer.invoke('demands:getOne', id),
    create: (data) => ipcRenderer.invoke('demands:create', data),
    update: (data) => ipcRenderer.invoke('demands:update', data),
    delete: (id) => ipcRenderer.invoke('demands:delete', id),
  },

  // Chat
  chat: {
    getConversations: (userId) => ipcRenderer.invoke('chat:getConversations', userId),
    getConversation: (id) => ipcRenderer.invoke('chat:getConversation', id),
    createConversation: (data) => ipcRenderer.invoke('chat:createConversation', data),
    deleteConversation: (id, userId) => ipcRenderer.invoke('chat:deleteConversation', id, userId),
    updateConversation: (data) => ipcRenderer.invoke('chat:updateConversation', data),
    addMessage: (data) => ipcRenderer.invoke('chat:addMessage', data),
    getHistory: (conversationId) => ipcRenderer.invoke('chat:getHistory', conversationId),
  },

  // Network
  network: {
    start: (userInfo) => ipcRenderer.invoke('network:start', userInfo),
    getPeers: () => ipcRenderer.invoke('network:getPeers'),
    sendToPeer: (host, data) => ipcRenderer.invoke('network:sendToPeer', { host, data }),
  },

  // Users messaging
  users: {
    sendMessage: (data) => ipcRenderer.invoke('users:sendMessage', data),
    getMessages: (userId, otherUserId) => ipcRenderer.invoke('users:getMessages', { userId, otherUserId }),
    getConversations: (userId) => ipcRenderer.invoke('users:getConversations', userId),
    deleteMessage: (id) => ipcRenderer.invoke('users:deleteMessage', id),
    blockUser: (fromId, toId) => ipcRenderer.invoke('users:blockUser', { userId: fromId, blockUserId: toId }),
    archiveChat: (fromId, toId) => ipcRenderer.invoke('users:archiveChat', { userId: fromId, otherUserId: toId }),
    shareItem: (data) => ipcRenderer.invoke('users:shareItem', data),
    getSharedItems: (userId) => ipcRenderer.invoke('users:getSharedItems', userId),
  },
  
  // Files
  files: {
    save: (data) => ipcRenderer.invoke('files:save', data),
    getPath: (data) => ipcRenderer.invoke('files:getPath', data),
    delete: (filePath) => ipcRenderer.invoke('files:delete', filePath),
    open: (filePath) => ipcRenderer.invoke('files:open', filePath),
    readAsBase64: (filePath) => ipcRenderer.invoke('files:readAsBase64', filePath),
  },
  
  // Dialogs
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  },
  
  // Data
  data: {
    export: (userId) => ipcRenderer.invoke('data:export', userId),
    import: (userId) => ipcRenderer.invoke('data:import', userId),
  },
  
  // Settings
  settings: {
    get: (userId) => ipcRenderer.invoke('settings:get', userId),
    save: (data) => ipcRenderer.invoke('settings:save', data),
  },

  // AI
  ai: {
    refine: (text, apiKey) => ipcRenderer.invoke('ai:refine', { text, apiKey }),
    chat: (messages, apiKey) => ipcRenderer.invoke('ai:chat', { messages, apiKey }),
  },
  
  // Reminder window events
  reminder: {
    openNote: (noteId) => ipcRenderer.send('reminder:openNote', noteId),
    dismiss: (reminderId) => ipcRenderer.send('reminder:dismiss', reminderId),
  },
  
  // Listeners
  on: (channel, callback) => {
    const validChannels = ['navigate:note', 'reminder:trigger', 'window:ask-close-tray', 'network:peer-found', 'network:message'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => callback(...args));
    }
  },
  
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  }
});
