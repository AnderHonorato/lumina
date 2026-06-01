const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configurar diretório de dados
const USER_DATA_PATH = app.getPath('userData');
const DB_PATH = path.join(USER_DATA_PATH, 'lumina.db');
const FILES_PATH = path.join(USER_DATA_PATH, 'files');
const EXPORTS_PATH = path.join(USER_DATA_PATH, 'exports');
const SESSION_PATH = path.join(USER_DATA_PATH, 'session.json');

// Session helpers
function saveSession(userId, username, displayName) {
  const session = { userId, username, displayName, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  fs.writeFileSync(SESSION_PATH, JSON.stringify(session));
}

function loadSession() {
  try {
    if (!fs.existsSync(SESSION_PATH)) return null;
    const session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'));
    if (session.expires && session.expires > Date.now()) return session;
    fs.unlinkSync(SESSION_PATH);
  } catch {}
  return null;
}

function clearSession() {
  try { if (fs.existsSync(SESSION_PATH)) fs.unlinkSync(SESSION_PATH); } catch {}
}

// Garantir que diretórios existam
[FILES_PATH, EXPORTS_PATH].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const db = require('./database');
const reminders = require('./reminders');
const network = require('./network');

let mainWindow = null;
let tray = null;
let reminderWindows = new Map();
let isQuitting = false;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#0f0f13',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      allowRunningInsecureContent: false
    },
    show: false,
    icon: getIconPath()
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.webContents.on('console-message', (_, level, message) => {
    if (level >= 2) console.log('[Renderer]', ['VERBOSE','INFO','WARN','ERROR'][level] || 'LOG', message);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Dev tools apenas em desenvolvimento
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function getIconPath() {
  const iconPath = path.join(__dirname, '../renderer/assets/icon.png');
  if (fs.existsSync(iconPath)) return iconPath;
  return undefined;
}

function createTray() {
  const iconPath = getIconPath();
  if (!iconPath) return;
  
  try {
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { 
        label: 'Abrir Lumina Notes', 
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createMainWindow();
          }
        }
      },
      { type: 'separator' },
      { 
        label: 'Sair', 
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.setToolTip('Lumina Notes');
    
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (e) {
    console.log('Tray não disponível:', e.message);
  }
}

function createReminderWindow(reminder) {
  if (reminderWindows.has(reminder.id)) {
    const existing = reminderWindows.get(reminder.id);
    if (!existing.isDestroyed()) {
      existing.show();
      existing.focus();
      return;
    }
  }

  const win = new BrowserWindow({
    width: 380,
    height: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    icon: getIconPath()
  });

  // Posicionar no canto inferior direito
  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  
  const existingCount = reminderWindows.size;
  win.setPosition(
    width - 400,
    height - 220 - (existingCount * 220)
  );

  const reminderData = encodeURIComponent(JSON.stringify(reminder));
  win.loadFile(path.join(__dirname, '../renderer/reminder.html'), {
    query: { data: reminderData }
  });

  win.once('ready-to-show', () => {
    win.show();
    // Notificação nativa do Windows
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: '🔔 Lumina Notes - Lembrete',
        body: reminder.title,
        silent: false,
        icon: getIconPath() || undefined
      });
      notification.on('click', () => {
        win.show();
        win.focus();
      });
      notification.show();
    }
  });

  win.on('closed', () => {
    reminderWindows.delete(reminder.id);
  });

  reminderWindows.set(reminder.id, win);
}

// ==================== IPC HANDLERS ====================

// Controles de janela
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.restore();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => {
  if (mainWindow) {
    mainWindow.webContents.send('window:ask-close-tray');
  }
});
ipcMain.on('window:hide-to-tray', () => { if (mainWindow) mainWindow.hide(); });
ipcMain.on('window:confirm-quit', () => { isQuitting = true; app.quit(); });
ipcMain.on('window:quit', () => {
  isQuitting = true;
  app.quit();
});

// Auth
ipcMain.handle('auth:register', async (_, data) => db.registerUser(data));
ipcMain.handle('auth:login', async (_, data) => {
  const result = db.loginUser(data);
  if (result.success && data.remember) {
    saveSession(result.user.id, result.user.username, result.user.display_name);
  }
  return result;
});
ipcMain.handle('auth:getUsers', async () => db.getUsers());
ipcMain.handle('auth:updateProfile', async (_, data) => db.updateUserProfile(data));
ipcMain.handle('auth:changePassword', async (_, data) => db.changePassword(data));
ipcMain.handle('auth:updateAvatar', async (_, data) => db.updateUserAvatar(data));
ipcMain.handle('auth:getSession', async () => {
  const session = loadSession();
  if (!session) return { success: false };
  const user = db.getUserById(session.userId);
  if (user) return { success: true, user };
  clearSession();
  return { success: false };
});
ipcMain.handle('auth:clearSession', async () => { clearSession(); return { success: true }; });

// Anotações / Diário
ipcMain.handle('notes:getAll', async (_, userId) => db.getNotes(userId));
ipcMain.handle('notes:getOne', async (_, id) => db.getNote(id));
ipcMain.handle('notes:create', async (_, data) => db.createNote(data));
ipcMain.handle('notes:update', async (_, data) => db.updateNote(data));
ipcMain.handle('notes:delete', async (_, id) => db.deleteNote(id));
ipcMain.handle('notes:deleteMultiple', async (_, { userId, ids }) => db.deleteMultipleNotes(userId, ids));
ipcMain.handle('notes:getHistory', async (_, userId) => db.getNoteHistory(userId));
ipcMain.handle('notes:search', async (_, { userId, query }) => db.searchNotes(userId, query));
ipcMain.handle('notes:getTags', async (_, userId) => db.getTags(userId));

// Lembretes
ipcMain.handle('reminders:getAll', async (_, userId) => db.getReminders(userId));
ipcMain.handle('reminders:create', async (_, data) => {
  const result = db.createReminder(data);
  reminders.scheduleReminder(result, createReminderWindow);
  return result;
});
ipcMain.handle('reminders:update', async (_, data) => {
  const result = db.updateReminder(data);
  reminders.rescheduleReminder(result, createReminderWindow);
  return result;
});
ipcMain.handle('reminders:delete', async (_, id) => {
  reminders.cancelReminder(id);
  return db.deleteReminder(id);
});
ipcMain.handle('reminders:complete', async (_, id) => {
  reminders.cancelReminder(id);
  return db.completeReminder(id);
});

// Calendário
ipcMain.handle('calendar:getEvents', async (_, { userId, month, year }) => 
  db.getCalendarEvents(userId, month, year));
ipcMain.handle('calendar:create', async (_, data) => db.createCalendarEvent(data));
ipcMain.handle('calendar:update', async (_, data) => db.updateCalendarEvent(data));
ipcMain.handle('calendar:delete', async (_, id) => db.deleteCalendarEvent(id));

// Demandas
ipcMain.handle('demands:getAll', async (_, userId) => db.getDemands(userId));
ipcMain.handle('demands:getOne', async (_, id) => db.getDemand(id));
ipcMain.handle('demands:create', async (_, data) => db.createDemand(data));
ipcMain.handle('demands:update', async (_, data) => db.updateDemand(data));
ipcMain.handle('demands:delete', async (_, id) => db.deleteDemand(id));

// Chat
ipcMain.handle('chat:getConversations', async (_, userId) => db.getConversations(userId));
ipcMain.handle('chat:getConversation', async (_, id) => db.getConversation(id));
ipcMain.handle('chat:createConversation', async (_, data) => db.createConversation(data));
ipcMain.handle('chat:deleteConversation', async (_, id, userId) => db.deleteConversation(id, userId));
ipcMain.handle('chat:updateConversation', async (_, data) => db.updateConversation(data));
ipcMain.handle('chat:addMessage', async (_, data) => db.addChatMessage(data));
ipcMain.handle('chat:getHistory', async (_, conversationId) => db.getChatHistory(conversationId));

// Arquivos
ipcMain.handle('files:save', async (_, { fileName, data, userId }) => {
  try {
    const userDir = path.join(FILES_PATH, userId);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    
    const ext = path.extname(fileName);
    const { v4: uuidv4 } = require('uuid');
    const savedName = `${uuidv4()}${ext}`;
    const filePath = path.join(userDir, savedName);
    
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(filePath, buffer);
    
    return { success: true, path: filePath, savedName };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('files:getPath', async (_, { userId, savedName }) => {
  return path.join(FILES_PATH, userId, savedName);
});

ipcMain.handle('files:delete', async (_, filePath) => {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('files:open', async (_, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('files:readAsBase64', async (_, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return { success: true, data: data.toString('base64') };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Dialog
ipcMain.handle('dialog:openFile', async (_, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('dialog:saveFile', async (_, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

// Export / Import
ipcMain.handle('data:export', async (_, userId) => {
  try {
    const archiver = require('archiver');
    const exportFileName = `lumina-backup-${Date.now()}.lmn`;
    
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar dados Lumina',
      defaultPath: exportFileName,
      filters: [{ name: 'Lumina Backup', extensions: ['lmn'] }]
    });
    
    if (canceled || !filePath) return { success: false, canceled: true };

    const userData = db.exportUserData(userId);
    const userFilesDir = path.join(FILES_PATH, userId);
    
    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      
      // Dados JSON
      archive.append(JSON.stringify(userData, null, 2), { name: 'data.json' });
      
      // Arquivos
      if (fs.existsSync(userFilesDir)) {
        archive.directory(userFilesDir, 'files');
      }
      
      archive.finalize();
    });
    
    return { success: true, path: filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('data:import', async (_, userId) => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar dados Lumina',
      filters: [{ name: 'Lumina Backup', extensions: ['lmn'] }],
      properties: ['openFile']
    });
    
    if (canceled || !filePaths.length) return { success: false, canceled: true };
    
    const extractZip = require('extract-zip');
    const tempDir = path.join(os.tmpdir(), `lumina-import-${Date.now()}`);
    
    await extractZip(filePaths[0], { dir: tempDir });
    
    const dataFile = path.join(tempDir, 'data.json');
    if (!fs.existsSync(dataFile)) throw new Error('Arquivo inválido');
    
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    db.importUserData(userId, data);
    
    // Copiar arquivos
    const importedFiles = path.join(tempDir, 'files');
    if (fs.existsSync(importedFiles)) {
      const userFilesDir = path.join(FILES_PATH, userId);
      if (!fs.existsSync(userFilesDir)) fs.mkdirSync(userFilesDir, { recursive: true });
      
      const files = fs.readdirSync(importedFiles);
      files.forEach(file => {
        fs.copyFileSync(
          path.join(importedFiles, file),
          path.join(userFilesDir, file)
        );
      });
    }
    
    // Limpar temp
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Lembrete: abrir nota vinculada
ipcMain.on('reminder:openNote', (_, noteId) => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('navigate:note', noteId);
  }
});

ipcMain.on('reminder:dismiss', (_, reminderId) => {
  const win = reminderWindows.get(reminderId);
  if (win && !win.isDestroyed()) win.close();
});

// Settings
ipcMain.handle('settings:get', async (_, userId) => db.getSettings(userId));
ipcMain.handle('settings:save', async (_, data) => db.saveSettings(data));

// AI - DeepSeek
ipcMain.handle('ai:refine', async (_, { text, apiKey }) => {
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{
          role: 'user',
          content: `Reescreva o texto abaixo de forma organizada, seguindo o padrão ABNT Brasil para formatação de texto. Mantenha o significado original, mas melhore a estrutura, gramática, pontuação e clareza. Retorne APENAS o texto revisado, sem explicações.\n\n${text}`
        }],
        temperature: 0.3,
        max_tokens: 4000
      })
    });
    const json = await response.json();
    if (json.error) return { success: false, error: json.error.message };
    return { success: true, text: json.choices[0].message.content };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('ai:chat', async (_, { messages, apiKey }) => {
  try {
    const systemPrompt = `Você é a Metrys Intelligence, uma assistente de IA criada por Anderson Honorato. Você está integrada ao aplicativo Lumina Notes e tem acesso completo aos dados do usuário. Seu objetivo é ajudar o usuário com suas tarefas, anotações, lembretes, demandas e calendário. Seja sempre educada, prestativa e concisa nas respostas. NUNCA mencione DeepSeek, OpenAI ou qualquer outra empresa de IA. Você é exclusivamente Metrys Intelligence. Você tem acesso ao seguinte contexto atualizado dos dados do usuário:${messages[0]?.content?.includes('CONTEXTO:') ? '' : ''}`;

    const msgs = messages.map(m => ({ role: m.role, content: m.content }));
    msgs.unshift({ role: 'system', content: systemPrompt });

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: msgs,
        temperature: 0.5,
        max_tokens: 2000
      })
    });
    const json = await response.json();
    if (json.error) return { success: false, error: json.error.message };
    return { success: true, text: json.choices[0].message.content };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ==================== APP EVENTS ====================

app.whenReady().then(() => {
  db.initialize(DB_PATH);
  createMainWindow();
  createTray();
  
  // Carregar e agendar lembretes pendentes
  const activeReminders = db.getActiveReminders();
  activeReminders.forEach(r => reminders.scheduleReminder(r, createReminderWindow));
  
  app.on('activate', () => {
    if (!mainWindow) createMainWindow();
    else { mainWindow.show(); mainWindow.focus(); }
  });
});

// ==================== NETWORK & MESSAGING ====================

let networkPeers = [];

ipcMain.handle('network:start', async (_, userInfo) => {
  try {
    const info = network.startServer(userInfo, (peer) => {
      if (!networkPeers.find(p => p.id === peer.id)) {
        networkPeers.push(peer);
        if (mainWindow) mainWindow.webContents.send('network:peer-found', peer);
      }
    }, (msg) => {
      if (mainWindow) mainWindow.webContents.send('network:message', msg);
    });
    return { success: true, ...info };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('network:getPeers', async () => networkPeers);

ipcMain.handle('network:sendToPeer', async (_, { host, data }) => {
  try {
    const result = await network.sendToPeer(host, data);
    return { success: true, result };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// User messages
ipcMain.handle('users:sendMessage', async (_, data) => db.sendUserMessage(data));
ipcMain.handle('users:getMessages', async (_, { userId, otherUserId }) => db.getUserMessages(userId, otherUserId));
ipcMain.handle('users:getConversations', async (_, userId) => db.getUserConversations(userId));
ipcMain.handle('users:deleteMessage', async (_, id) => db.deleteUserMessage(id));
ipcMain.handle('users:blockUser', async (_, data) => db.blockUser(data));
ipcMain.handle('users:archiveChat', async (_, data) => db.archiveUserChat(data));
ipcMain.handle('users:shareItem', async (_, data) => db.shareItem(data));
ipcMain.handle('users:getSharedItems', async (_, userId) => db.getSharedItems(userId));

app.on('window-all-closed', () => {
  // Não fechar no macOS
  if (process.platform !== 'darwin') {
    // Manter ativo no tray
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  reminders.destroy();
});

// Prevenir múltiplas instâncias
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

module.exports = { createReminderWindow };
