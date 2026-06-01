const bcrypt = require('bcryptjs');

let db = null;

function initialize(dbPath) {
  const Database = require('better-sqlite3');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createTables();
  console.log('Database inicializado em:', dbPath);
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      avatar_color TEXT DEFAULT '#6C63FF',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Sem título',
      content TEXT DEFAULT '',
      type TEXT DEFAULT 'note',
      mood TEXT,
      tags TEXT DEFAULT '[]',
      attachments TEXT DEFAULT '[]',
      is_pinned INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      color TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      note_id TEXT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      remind_at DATETIME NOT NULL,
      repeat_type TEXT DEFAULT 'none',
      repeat_interval INTEGER DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      is_dismissed INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'normal',
      color TEXT DEFAULT '#6C63FF',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      note_id TEXT,
      reminder_id TEXT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      event_date DATE NOT NULL,
      start_time TEXT,
      end_time TEXT,
      color TEXT DEFAULT '#6C63FF',
      all_day INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      theme TEXT DEFAULT 'dark',
      accent_color TEXT DEFAULT '#6C63FF',
      font_size TEXT DEFAULT 'medium',
      language TEXT DEFAULT 'pt-BR',
      notifications_enabled INTEGER DEFAULT 1,
      sound_enabled INTEGER DEFAULT 1,
      timeline_direction TEXT DEFAULT 'asc',
      sidebar_collapsed INTEGER DEFAULT 0,
      data TEXT DEFAULT '{}',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS file_attachments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      note_id TEXT,
      original_name TEXT NOT NULL,
      saved_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
  `);

  // Migrations for existing databases
  const migrations = [
    'ALTER TABLE users ADD COLUMN avatar_photo TEXT DEFAULT \'\'',
    'ALTER TABLE users ADD COLUMN bio TEXT DEFAULT \'\'',
    'ALTER TABLE users ADD COLUMN city TEXT DEFAULT \'\'',
    'ALTER TABLE users ADD COLUMN state TEXT DEFAULT \'\'',
    'ALTER TABLE users ADD COLUMN birthday TEXT DEFAULT \'\'',
    `CREATE TABLE IF NOT EXISTS notes_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      original_id TEXT,
      title TEXT NOT NULL DEFAULT 'Sem título',
      type TEXT DEFAULT 'note',
      deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS demands (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Sem título',
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      color TEXT DEFAULT 'default',
      tags TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS demand_steps (
      id TEXT PRIMARY KEY,
      demand_id TEXT NOT NULL,
      step_order INTEGER DEFAULT 0,
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      image_data TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (demand_id) REFERENCES demands(id) ON DELETE CASCADE
    )`
  ];

  migrations.forEach(sql => {
    try { db.exec(sql); } catch {}
  });

  // New tables via migration
  const newTables = [
    `CREATE TABLE IF NOT EXISTS chat_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT DEFAULT 'Nova conversa',
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS user_messages (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      content TEXT DEFAULT '',
      file_name TEXT DEFAULT '',
      file_data TEXT DEFAULT '',
      file_type TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      is_blocked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS shared_items (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  ];
  newTables.forEach(sql => { try { db.exec(sql); } catch {} });
}

// ==================== USERS ====================

function registerUser({ username, email, password, displayName }) {
  try {
    const { v4: uuidv4 } = require('uuid');
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email || '');
    if (existing) return { success: false, error: 'Usuário ou email já existe' };
    
    const hash = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    const colors = ['#6C63FF', '#FF6584', '#43B89C', '#F7931E', '#4FC3F7', '#BA68C8'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];
    
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, display_name, avatar_color)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, username, email || null, hash, displayName || username, avatarColor);
    
    // Criar settings padrão
    db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(id);
    
    const user = db.prepare('SELECT id, username, email, display_name, avatar_color, avatar_photo, created_at FROM users WHERE id = ?').get(id);
    return { success: true, user };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function loginUser({ username, password }) {
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
    if (!user) return { success: false, error: 'Usuário não encontrado' };
    
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return { success: false, error: 'Senha incorreta' };
    
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    
    return { 
      success: true, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email,
        display_name: user.display_name, 
        avatar_color: user.avatar_color,
        avatar_photo: user.avatar_photo,
        bio: user.bio || '',
        city: user.city || '',
        state: user.state || '',
        birthday: user.birthday || '',
        created_at: user.created_at
      } 
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getUsers() {
  return db.prepare('SELECT id, username, display_name, avatar_color, avatar_photo, bio, city, state, birthday FROM users ORDER BY display_name').all();
}

function getUserById(userId) {
  const user = db.prepare('SELECT id, username, email, display_name, avatar_color, avatar_photo, bio, city, state, birthday, created_at FROM users WHERE id = ?').get(userId);
  if (!user) return null;
  return user;
}

function updateUserProfile({ userId, displayName, email, avatarColor, bio, city, state, birthday }) {
  try {
    db.prepare(`UPDATE users SET display_name = ?, email = ?, avatar_color = ?, bio = ?, city = ?, state = ?, birthday = ? WHERE id = ?`)
      .run(displayName, email, avatarColor, bio || '', city || '', state || '', birthday || '', userId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function changePassword({ userId, currentPassword, newPassword }) {
  try {
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return { success: false, error: 'Senha atual incorreta' };
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function updateUserAvatar({ userId, avatarPhoto }) {
  try {
    db.prepare('UPDATE users SET avatar_photo = ? WHERE id = ?').run(avatarPhoto || '', userId);
    return { success: true, avatarPhoto: avatarPhoto || '' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ==================== NOTES ====================

function getNotes(userId) {
  const notes = db.prepare(`
    SELECT * FROM notes WHERE user_id = ?
    ORDER BY is_pinned DESC, created_at ASC
  `).all(userId);
  
  return notes.map(n => ({
    ...n,
    tags: JSON.parse(n.tags || '[]'),
    attachments: JSON.parse(n.attachments || '[]'),
    is_pinned: Boolean(n.is_pinned),
    is_favorite: Boolean(n.is_favorite)
  }));
}

function getNote(id) {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  if (!note) return null;
  return {
    ...note,
    tags: JSON.parse(note.tags || '[]'),
    attachments: JSON.parse(note.attachments || '[]'),
    is_pinned: Boolean(note.is_pinned),
    is_favorite: Boolean(note.is_favorite)
  };
}

function createNote({ userId, title, content, type, mood, tags, attachments, color, isPinned, isFavorite }) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO notes (id, user_id, title, content, type, mood, tags, attachments, color, is_pinned, is_favorite)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, userId, 
    title || 'Sem título', 
    content || '', 
    type || 'note',
    mood || null,
    JSON.stringify(tags || []),
    JSON.stringify(attachments || []),
    color || 'default',
    isPinned ? 1 : 0,
    isFavorite ? 1 : 0
  );
  
  return getNote(id);
}

function updateNote({ id, title, content, type, mood, tags, attachments, color, isPinned, isFavorite }) {
  db.prepare(`
    UPDATE notes SET 
      title = ?, content = ?, type = ?, mood = ?, tags = ?, 
      attachments = ?, color = ?, is_pinned = ?, is_favorite = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    title, content, type, mood,
    JSON.stringify(tags || []),
    JSON.stringify(attachments || []),
    color,
    isPinned ? 1 : 0,
    isFavorite ? 1 : 0,
    id
  );
  
  return getNote(id);
}

function deleteNote(id) {
  const note = db.prepare('SELECT id, user_id, title, type FROM notes WHERE id = ?').get(id);
  if (note) {
    const { v4: uuidv4 } = require('uuid');
    db.prepare('INSERT INTO notes_history (id, user_id, original_id, title, type) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), note.user_id, note.id, note.title, note.type);
  }
  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  return { success: true };
}

function deleteMultipleNotes(userId, ids) {
  const { v4: uuidv4 } = require('uuid');
  const deleteStmt = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?');
  const historyStmt = db.prepare('INSERT INTO notes_history (id, user_id, original_id, title, type) VALUES (?, ?, ?, ?, ?)');
  
  const transaction = db.transaction((noteIds) => {
    for (const id of noteIds) {
      const note = db.prepare('SELECT id, title, type FROM notes WHERE id = ? AND user_id = ?').get(id, userId);
      if (note) {
        historyStmt.run(uuidv4(), userId, note.id, note.title, note.type);
      }
      deleteStmt.run(id, userId);
    }
  });
  
  transaction(ids);
  return { success: true, deletedCount: ids.length };
}

function getNoteHistory(userId) {
  return db.prepare(`
    SELECT * FROM notes_history WHERE user_id = ?
    ORDER BY deleted_at DESC
  `).all(userId);
}

// ==================== DEMANDS ====================

function getDemands(userId) {
  const demands = db.prepare(`
    SELECT d.*, (SELECT COUNT(*) FROM demand_steps WHERE demand_id = d.id) as steps_count
    FROM demands d WHERE d.user_id = ?
    ORDER BY d.created_at DESC
  `).all(userId);
  
  return demands.map(d => ({
    ...d,
    tags: JSON.parse(d.tags || '[]')
  }));
}

function getDemand(id) {
  const demand = db.prepare('SELECT * FROM demands WHERE id = ?').get(id);
  if (!demand) return null;
  const steps = db.prepare('SELECT * FROM demand_steps WHERE demand_id = ? ORDER BY step_order ASC').all(id);
  return {
    ...demand,
    tags: JSON.parse(demand.tags || '[]'),
    steps
  };
}

function createDemand({ userId, title, description, status, priority, color, tags, steps }) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO demands (id, user_id, title, description, status, priority, color, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, title || 'Sem título', description || '', status || 'pending', priority || 'normal', color || 'default', JSON.stringify(tags || []));
  
  if (steps && steps.length) {
    const insertStep = db.prepare('INSERT INTO demand_steps (id, demand_id, step_order, title, content, image_data) VALUES (?, ?, ?, ?, ?, ?)');
    steps.forEach((s, i) => {
      insertStep.run(uuidv4(), id, i + 1, s.title || '', s.content || '', s.image_data || '');
    });
  }
  
  return getDemand(id);
}

function updateDemand({ id, title, description, status, priority, color, tags, steps }) {
  db.prepare(`
    UPDATE demands SET title = ?, description = ?, status = ?, priority = ?, color = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, description, status, priority, color, JSON.stringify(tags || []), id);
  
  if (steps !== undefined) {
    const { v4: uuidv4 } = require('uuid');
    db.prepare('DELETE FROM demand_steps WHERE demand_id = ?').run(id);
    const insertStep = db.prepare('INSERT INTO demand_steps (id, demand_id, step_order, title, content, image_data) VALUES (?, ?, ?, ?, ?, ?)');
    steps.forEach((s, i) => {
      insertStep.run(uuidv4(), id, i + 1, s.title || '', s.content || '', s.image_data || '');
    });
  }
  
  return getDemand(id);
}

function deleteDemand(id) {
  db.prepare('DELETE FROM demand_steps WHERE demand_id = ?').run(id);
  db.prepare('DELETE FROM demands WHERE id = ?').run(id);
  return { success: true };
}

// ==================== CHAT ====================

function getConversations(userId) {
  return db.prepare(`
    SELECT c.*, (SELECT content FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
    (SELECT created_at FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
    FROM chat_conversations c WHERE c.user_id = ? AND c.is_archived = 0
    ORDER BY c.is_pinned DESC, c.updated_at DESC
  `).all(userId);
}

function getConversation(id) {
  const conv = db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(id);
  if (!conv) return null;
  const messages = db.prepare('SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC').all(id);
  return { ...conv, messages };
}

function createConversation({ userId, title }) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  db.prepare('INSERT INTO chat_conversations (id, user_id, title) VALUES (?, ?, ?)').run(id, userId, title || 'Nova conversa');
  return { id, title: title || 'Nova conversa', is_pinned: 0, is_archived: 0 };
}

function deleteConversation(id, userId) {
  db.prepare('DELETE FROM chat_messages WHERE conversation_id = ?').run(id);
  db.prepare('DELETE FROM chat_conversations WHERE id = ? AND user_id = ?').run(id, userId);
  return { success: true };
}

function updateConversation({ id, title, is_pinned, is_archived }) {
  if (title !== undefined) db.prepare('UPDATE chat_conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(title, id);
  if (is_pinned !== undefined) db.prepare('UPDATE chat_conversations SET is_pinned = ? WHERE id = ?').run(is_pinned ? 1 : 0, id);
  if (is_archived !== undefined) db.prepare('UPDATE chat_conversations SET is_archived = ? WHERE id = ?').run(is_archived ? 1 : 0, id);
  return { success: true };
}

function addChatMessage({ conversationId, role, content }) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  db.prepare('INSERT INTO chat_messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(id, conversationId, role, content);
  db.prepare('UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId);
  return { id, conversationId, role, content, created_at: new Date().toISOString() };
}

function getChatHistory(conversationId) {
  return db.prepare('SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conversationId);
}

// ==================== USER MESSAGES ====================

function sendUserMessage({ fromUserId, toUserId, content, fileName, fileData, fileType }) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  db.prepare(`INSERT INTO user_messages (id, from_user_id, to_user_id, content, file_name, file_data, file_type) VALUES (?,?,?,?,?,?,?)`)
    .run(id, fromUserId, toUserId, content || '', fileName || '', fileData || '', fileType || '');
  return { success: true, id };
}

function getUserMessages(userId, otherUserId) {
  return db.prepare(`
    SELECT * FROM user_messages 
    WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
    ORDER BY created_at ASC
  `).all(userId, otherUserId, otherUserId, userId);
}

function getUserConversations(userId) {
  return db.prepare(`
    SELECT DISTINCT 
      CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END as other_user_id,
      (SELECT content FROM user_messages WHERE (from_user_id = ? AND to_user_id = other_user_id) OR (from_user_id = other_user_id AND to_user_id = ?) ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM user_messages WHERE (from_user_id = ? AND to_user_id = other_user_id) OR (from_user_id = other_user_id AND to_user_id = ?) ORDER BY created_at DESC LIMIT 1) as last_message_at
    FROM user_messages WHERE from_user_id = ? OR to_user_id = ?
  `).all(userId, userId, userId, userId, userId, userId, userId);
}

function deleteUserMessage(id) {
  db.prepare('DELETE FROM user_messages WHERE id = ?').run(id);
  return { success: true };
}

function blockUser({ userId, blockUserId }) {
  db.prepare('UPDATE user_messages SET is_blocked = 1 WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)')
    .run(userId, blockUserId, blockUserId, userId);
  return { success: true };
}

function archiveUserChat({ userId, otherUserId }) {
  db.prepare('UPDATE user_messages SET is_archived = 1 WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)')
    .run(userId, otherUserId, otherUserId, userId);
  return { success: true };
}

function shareItem({ fromUserId, toUserId, itemType, itemData }) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  db.prepare('INSERT INTO shared_items (id, from_user_id, to_user_id, item_type, item_data) VALUES (?,?,?,?,?)')
    .run(id, fromUserId, toUserId, itemType, itemData);
  return { success: true, id };
}

function getSharedItems(userId) {
  return db.prepare('SELECT si.*, u.display_name as from_name FROM shared_items si JOIN users u ON si.from_user_id = u.id WHERE si.to_user_id = ? ORDER BY si.created_at DESC').all(userId);
}

function searchNotes(userId, query) {
  const q = `%${query}%`;
  const notes = db.prepare(`
    SELECT * FROM notes 
    WHERE user_id = ? AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)
    ORDER BY is_pinned DESC, updated_at DESC
  `).all(userId, q, q, q);
  
  return notes.map(n => ({
    ...n,
    tags: JSON.parse(n.tags || '[]'),
    attachments: JSON.parse(n.attachments || '[]'),
    is_pinned: Boolean(n.is_pinned),
    is_favorite: Boolean(n.is_favorite)
  }));
}

function getTags(userId) {
  const notes = db.prepare('SELECT tags FROM notes WHERE user_id = ?').all(userId);
  const allTags = new Set();
  notes.forEach(n => {
    try {
      JSON.parse(n.tags || '[]').forEach(t => allTags.add(t));
    } catch {}
  });
  return Array.from(allTags);
}

// ==================== REMINDERS ====================

function getReminders(userId) {
  return db.prepare(`
    SELECT r.*, n.title as note_title FROM reminders r
    LEFT JOIN notes n ON r.note_id = n.id
    WHERE r.user_id = ?
    ORDER BY r.remind_at ASC
  `).all(userId);
}

function getActiveReminders() {
  return db.prepare(`
    SELECT * FROM reminders 
    WHERE is_completed = 0 AND is_dismissed = 0 
    AND remind_at > datetime('now')
  `).all();
}

function createReminder({ userId, noteId, title, description, remindAt, repeatType, repeatInterval, priority, color }) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO reminders (id, user_id, note_id, title, description, remind_at, repeat_type, repeat_interval, priority, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, noteId || null, title, description || '', remindAt, repeatType || 'none', repeatInterval || 0, priority || 'normal', color || '#6C63FF');
  
  return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
}

function updateReminder({ id, title, description, remindAt, repeatType, repeatInterval, priority, color, noteId }) {
  db.prepare(`
    UPDATE reminders SET title = ?, description = ?, remind_at = ?, 
    repeat_type = ?, repeat_interval = ?, priority = ?, color = ?, note_id = ?
    WHERE id = ?
  `).run(title, description, remindAt, repeatType, repeatInterval, priority, color, noteId || null, id);
  
  return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
}

function deleteReminder(id) {
  db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
  return { success: true };
}

function completeReminder(id) {
  db.prepare('UPDATE reminders SET is_completed = 1 WHERE id = ?').run(id);
  return { success: true };
}

// ==================== CALENDAR ====================

function getCalendarEvents(userId, month, year) {
  return db.prepare(`
    SELECT ce.*, n.title as note_title, r.title as reminder_title
    FROM calendar_events ce
    LEFT JOIN notes n ON ce.note_id = n.id
    LEFT JOIN reminders r ON ce.reminder_id = r.id
    WHERE ce.user_id = ? 
    AND strftime('%m', ce.event_date) = ? 
    AND strftime('%Y', ce.event_date) = ?
    ORDER BY ce.event_date ASC, ce.start_time ASC
  `).all(userId, String(month).padStart(2, '0'), String(year));
}

function createCalendarEvent({ userId, noteId, reminderId, title, description, eventDate, startTime, endTime, color, allDay }) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO calendar_events (id, user_id, note_id, reminder_id, title, description, event_date, start_time, end_time, color, all_day)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, noteId || null, reminderId || null, title, description || '', eventDate, startTime || null, endTime || null, color || '#6C63FF', allDay ? 1 : 0);
  
  return db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id);
}

function updateCalendarEvent({ id, title, description, eventDate, startTime, endTime, color, allDay }) {
  db.prepare(`
    UPDATE calendar_events SET title = ?, description = ?, event_date = ?, 
    start_time = ?, end_time = ?, color = ?, all_day = ?
    WHERE id = ?
  `).run(title, description, eventDate, startTime, endTime, color, allDay ? 1 : 0, id);
  
  return db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id);
}

function deleteCalendarEvent(id) {
  db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id);
  return { success: true };
}

// ==================== SETTINGS ====================

function getSettings(userId) {
  let settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  if (!settings) {
    db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);
    settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  }
  return { ...settings, data: JSON.parse(settings.data || '{}') };
}

function saveSettings({ userId, theme, accentColor, fontSize, language, notificationsEnabled, soundEnabled, timelineDirection, sidebarCollapsed, data }) {
  db.prepare(`
    UPDATE settings SET theme = ?, accent_color = ?, font_size = ?, language = ?,
    notifications_enabled = ?, sound_enabled = ?, timeline_direction = ?, 
    sidebar_collapsed = ?, data = ?
    WHERE user_id = ?
  `).run(
    theme, accentColor, fontSize, language,
    notificationsEnabled ? 1 : 0, soundEnabled ? 1 : 0,
    timelineDirection, sidebarCollapsed ? 1 : 0,
    JSON.stringify(data || {}), userId
  );
  return { success: true };
}

// ==================== EXPORT / IMPORT ====================

function exportUserData(userId) {
  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    notes: getNotes(userId),
    reminders: getReminders(userId),
    settings: getSettings(userId),
    calendar_events: db.prepare('SELECT * FROM calendar_events WHERE user_id = ?').all(userId)
  };
}

function importUserData(userId, data) {
  const importNote = db.transaction((notes) => {
    const { v4: uuidv4 } = require('uuid');
    const idMap = {};
    
    notes.forEach(note => {
      const newId = uuidv4();
      idMap[note.id] = newId;
      db.prepare(`
        INSERT OR IGNORE INTO notes (id, user_id, title, content, type, mood, tags, attachments, color, is_pinned, is_favorite, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newId, userId, note.title, note.content, note.type, note.mood,
        JSON.stringify(note.tags || []), JSON.stringify(note.attachments || []),
        note.color, note.is_pinned ? 1 : 0, note.is_favorite ? 1 : 0,
        note.created_at, note.updated_at
      );
    });
    return idMap;
  });

  if (data.notes) importNote(data.notes);
  
  if (data.reminders) {
    const { v4: uuidv4 } = require('uuid');
    data.reminders.forEach(r => {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO reminders (id, user_id, title, description, remind_at, repeat_type, repeat_interval, is_completed, priority, color, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), userId, r.title, r.description, r.remind_at, r.repeat_type, r.repeat_interval, r.is_completed, r.priority, r.color, r.created_at);
      } catch {}
    });
  }
  
  return { success: true };
}

module.exports = {
  initialize,
  registerUser, loginUser, getUsers, getUserById, updateUserProfile, changePassword, updateUserAvatar,
  getNotes, getNote, createNote, updateNote, deleteNote, deleteMultipleNotes, getNoteHistory, searchNotes, getTags,
  getReminders, getActiveReminders, createReminder, updateReminder, deleteReminder, completeReminder,
  getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  getSettings, saveSettings,
  getDemands, getDemand, createDemand, updateDemand, deleteDemand,
  getConversations, getConversation, createConversation, deleteConversation, updateConversation, addChatMessage, getChatHistory,
  sendUserMessage, getUserMessages, getUserConversations, deleteUserMessage, blockUser, archiveUserChat, shareItem, getSharedItems,
  exportUserData, importUserData
};
