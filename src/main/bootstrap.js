/*
 * Lumina Notes — bootstrap de segurança do processo principal.
 * Mantém main.js intacto e aplica guardas antes de carregá-lo.
 */
const electron = require('electron');
const fs = require('fs');
const path = require('path');

const { app, ipcMain, dialog, safeStorage } = electron;
const originalBrowserWindow = electron.BrowserWindow;
const originalHandle = ipcMain.handle.bind(ipcMain);
const originalOpenDialog = dialog.showOpenDialog.bind(dialog);
const selectedExternalFiles = new Set();

const userData = app.getPath('userData');
const filesRoot = path.resolve(userData, 'files');
const secureFile = path.resolve(userData, 'secure.dat.json');
const runtimePatchPath = path.join(__dirname, '../renderer/js/runtime-patches.js');

function isInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(String(candidate || '')));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
function safeUserId(value) { return /^[A-Za-z0-9-]{1,80}$/.test(String(value || '')); }
function safeSavedName(value) { return /^[A-Za-z0-9._-]{1,180}$/.test(String(value || '')) && path.basename(value) === value; }
function safeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.slice(0, 50).map(t => String(t).trim().toLowerCase().replace(/[^a-z0-9À-ÿ_.-]/gi, '-').replace(/-+/g, '-').slice(0, 48)).filter(Boolean);
}
function sanitizePayload(channel, args) {
  if (['notes:create','notes:update'].includes(channel) && args[0] && typeof args[0] === 'object') {
    args[0] = { ...args[0], tags: safeTags(args[0].tags) };
  }
  if (channel === 'files:save') {
    const d = args[0] || {};
    if (!safeUserId(d.userId)) throw new Error('Identificador de usuário inválido');
    args[0] = { ...d, fileName: path.basename(String(d.fileName || 'arquivo')).slice(0, 180) };
  }
  if (channel === 'files:getPath') {
    const d = args[0] || {};
    if (!safeUserId(d.userId) || !safeSavedName(d.savedName)) throw new Error('Caminho de anexo inválido');
  }
  if (['files:delete','files:open'].includes(channel)) {
    if (!isInside(filesRoot, args[0])) throw new Error('Acesso negado fora da área de anexos do Lumina');
  }
  if (channel === 'files:readAsBase64') {
    const candidate = path.resolve(String(args[0] || ''));
    if (!isInside(filesRoot, candidate) && !selectedExternalFiles.has(candidate)) throw new Error('Arquivo não autorizado');
  }
  return args;
}

// Registra arquivos explicitamente escolhidos pelo usuário para permitir leitura pontual pelo renderer.
dialog.showOpenDialog = async (...args) => {
  const result = await originalOpenDialog(...args);
  for (const file of result.filePaths || []) selectedExternalFiles.add(path.resolve(file));
  return result;
};

// Envolve handlers existentes sem alterar a API pública do preload.
ipcMain.handle = (channel, listener) => originalHandle(channel, async (event, ...args) => {
  try { args = sanitizePayload(channel, args); return await listener(event, ...args); }
  catch (error) { return { success: false, error: error.message || 'Operação bloqueada por segurança' }; }
});

function readSecureStore() {
  try { return JSON.parse(fs.readFileSync(secureFile, 'utf8')); } catch { return {}; }
}
function writeSecureStore(data) {
  fs.mkdirSync(path.dirname(secureFile), { recursive: true });
  fs.writeFileSync(secureFile, JSON.stringify(data), { mode: 0o600 });
}
function validSecretKey(key) { return key === 'ai-api-key'; }

originalHandle('secrets:set', async (_, { key, value }) => {
  if (!validSecretKey(key)) return { success: false, error: 'Chave de segredo inválida' };
  if (!safeStorage?.isEncryptionAvailable?.()) return { success: false, error: 'Criptografia do sistema indisponível' };
  const store = readSecureStore();
  store[key] = safeStorage.encryptString(String(value || '')).toString('base64');
  writeSecureStore(store);
  return { success: true };
});
originalHandle('secrets:get', async (_, { key }) => {
  if (!validSecretKey(key)) return { success: false };
  const store = readSecureStore();
  if (!store[key] || !safeStorage?.isEncryptionAvailable?.()) return { success: false };
  try { return { success: true, value: safeStorage.decryptString(Buffer.from(store[key], 'base64')) }; }
  catch { return { success: false, error: 'Não foi possível descriptografar o segredo' }; }
});
originalHandle('secrets:remove', async (_, { key }) => {
  if (!validSecretKey(key)) return { success: false };
  const store = readSecureStore(); delete store[key]; writeSecureStore(store); return { success: true };
});

class LuminaBrowserWindow extends originalBrowserWindow {
  constructor(options = {}) {
    const secureOptions = {
      ...options,
      webPreferences: {
        ...(options.webPreferences || {}),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        sandbox: false
      }
    };
    super(secureOptions);

    this.webContents.setWindowOpenHandler(({ url }) => {
      try {
        const parsed = new URL(url);
        if (['https:','mailto:'].includes(parsed.protocol)) electron.shell.openExternal(url);
      } catch {}
      return { action: 'deny' };
    });
    this.webContents.on('will-navigate', (event, url) => {
      if (!String(url).startsWith('file://')) event.preventDefault();
    });
    this.webContents.on('did-finish-load', () => {
      if (!this.webContents.getURL().includes('/renderer/index.html') || !fs.existsSync(runtimePatchPath)) return;
      const code = fs.readFileSync(runtimePatchPath, 'utf8');
      this.webContents.executeJavaScript(code, true).catch(err => console.warn('[Lumina] Runtime patches:', err.message));
    });
  }
}

try { electron.BrowserWindow = LuminaBrowserWindow; }
catch (error) { console.warn('[Lumina] Não foi possível substituir BrowserWindow:', error.message); }

require('./main');
