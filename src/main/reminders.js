const scheduledReminders = new Map();

function scheduleReminder(reminder, createReminderWindow) {
  if (!reminder || !reminder.remind_at) return;
  
  const now = new Date();
  const remindAt = new Date(reminder.remind_at);
  const delay = remindAt.getTime() - now.getTime();
  
  if (delay <= 0) return; // Já passou
  if (delay > 2147483647) return; // Max setTimeout (~24 dias)
  
  // Cancelar se já existe
  if (scheduledReminders.has(reminder.id)) {
    clearTimeout(scheduledReminders.get(reminder.id));
  }
  
  const timeout = setTimeout(() => {
    scheduledReminders.delete(reminder.id);
    createReminderWindow(reminder);
    
    // Se repetição, re-agendar
    if (reminder.repeat_type && reminder.repeat_type !== 'none') {
      const nextReminder = getNextRepeat(reminder);
      if (nextReminder) {
        scheduleReminder(nextReminder, createReminderWindow);
      }
    }
  }, delay);
  
  scheduledReminders.set(reminder.id, timeout);
  console.log(`Lembrete agendado: "${reminder.title}" em ${remindAt.toLocaleString('pt-BR')}`);
}

function getNextRepeat(reminder) {
  const current = new Date(reminder.remind_at);
  let next = null;
  
  switch (reminder.repeat_type) {
    case 'daily':
      next = new Date(current);
      next.setDate(next.getDate() + (reminder.repeat_interval || 1));
      break;
    case 'weekly':
      next = new Date(current);
      next.setDate(next.getDate() + 7 * (reminder.repeat_interval || 1));
      break;
    case 'monthly':
      next = new Date(current);
      next.setMonth(next.getMonth() + (reminder.repeat_interval || 1));
      break;
  }
  
  if (!next) return null;
  
  return { ...reminder, remind_at: next.toISOString() };
}

function rescheduleReminder(reminder, createReminderWindow) {
  cancelReminder(reminder.id);
  scheduleReminder(reminder, createReminderWindow);
}

function cancelReminder(id) {
  if (scheduledReminders.has(id)) {
    clearTimeout(scheduledReminders.get(id));
    scheduledReminders.delete(id);
  }
}

function destroy() {
  scheduledReminders.forEach(timeout => clearTimeout(timeout));
  scheduledReminders.clear();
}

module.exports = { scheduleReminder, rescheduleReminder, cancelReminder, destroy };
