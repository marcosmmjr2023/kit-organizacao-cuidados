const pad2 = value => String(value).padStart(2, '0');

function localDateParts(date) {
  return {
    date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  };
}

function addLocalDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes());
}

function compactDate(value) { return String(value || '').replaceAll('-', ''); }
function compactTime(value) { return String(value || '').replace(':', '') + '00'; }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')); }
function validTime(value) { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')); }
function uidPart(value) { return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '-'); }

export function escapeIcs(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
}

function utcStamp(date) {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;
}

function alarmBlock(description) {
  return [
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(description)}`,
    'END:VALARM',
  ];
}

function eventBlock({ uid, start, summary, description, stamp, repeat = false }) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@cuidalocal.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    ...(repeat ? ['RRULE:FREQ=DAILY'] : []),
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    ...alarmBlock(summary),
    'END:VEVENT',
  ];
}

function stableNotificationId(key) {
  let hash = 2166136261;
  for (const char of key) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483000 + 1;
}

export function buildNativeAlarmPlan(data, { now = new Date() } = {}) {
  const plan = [];
  for (const item of data?.collections?.agenda || []) {
    if (item.concluido || !validDate(item.data) || !validTime(item.hora)) continue;
    const scheduled = new Date(`${item.data}T${item.hora}:00`);
    if (Number.isNaN(scheduled.getTime()) || scheduled < now) continue;
    const key = `agenda:${item.id}`;
    plan.push({
      id: stableNotificationId(key),
      key,
      kind: 'agenda',
      title: `Compromisso: ${item.titulo || 'Compromisso cadastrado'}`,
      body: item.observacoes || item.local || `Horário cadastrado: ${item.hora}`,
      schedule: { at: `${item.data}T${item.hora}:00`, allowWhileIdle: true },
      extra: { route: 'agenda', itemId: item.id },
    });
  }

  for (const item of data?.collections?.medicamentos || []) {
    if (item.ativo === false) continue;
    for (const time of item.horarios || []) {
      if (!validTime(time)) continue;
      const [hour, minute] = time.split(':').map(Number);
      const key = `medicamentos:${item.id}:${time}`;
      plan.push({
        id: stableNotificationId(key),
        key,
        kind: 'medicamento',
        title: `Horário cadastrado: ${item.nome || 'Medicamento'}`,
        body: 'Confira a orientação profissional recebida. O CuidaLocal não define doses ou horários.',
        schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
        extra: { route: 'medicamentos', itemId: item.id, time },
      });
    }
  }

  const used = new Set();
  for (const notification of plan) {
    while (used.has(notification.id)) notification.id = notification.id % 2147483000 + 1;
    used.add(notification.id);
  }
  return plan;
}

export function collectDueReminders(data, {
  now = new Date(),
  acknowledgedKeys = new Set(),
  lookbackMinutes = 15,
} = {}) {
  const acknowledged = acknowledgedKeys instanceof Set ? acknowledgedKeys : new Set(acknowledgedKeys || []);
  const today = localDateParts(now).date;
  const reminders = [];
  const addIfDue = reminder => {
    const scheduled = new Date(`${reminder.date}T${reminder.time}:00`);
    if (Number.isNaN(scheduled.getTime())) return;
    const lateMinutes = Math.floor((now.getTime() - scheduled.getTime()) / 60000);
    if (lateMinutes < 0 || lateMinutes > lookbackMinutes || acknowledged.has(reminder.key)) return;
    reminders.push({ ...reminder, lateMinutes, scheduledAt: scheduled });
  };

  for (const item of data?.collections?.agenda || []) {
    if (item.concluido || item.data !== today || !validTime(item.hora)) continue;
    addIfDue({
      key: `agenda:${item.id}:${item.data}:${item.hora}`,
      kind: 'agenda',
      itemId: item.id,
      date: item.data,
      time: item.hora,
      title: item.titulo || 'Compromisso',
      body: item.observacoes || item.local || 'Compromisso cadastrado para agora.',
    });
  }

  for (const item of data?.collections?.medicamentos || []) {
    if (item.ativo === false) continue;
    for (const time of item.horarios || []) {
      if (!validTime(time)) continue;
      const handled = (data?.collections?.registrosMedicamentos || []).some(record =>
        record.medicamentoId === item.id && record.data === today && record.horaProgramada === time && record.status
      );
      if (handled) continue;
      addIfDue({
        key: `medicamentos:${item.id}:${today}:${time}`,
        kind: 'medicamento',
        itemId: item.id,
        date: today,
        time,
        title: item.nome || 'Medicamento cadastrado',
        body: 'Confira a orientação profissional recebida. O CuidaLocal não define doses ou horários.',
      });
    }
  }

  return reminders.sort((a, b) => a.scheduledAt - b.scheduledAt || a.kind.localeCompare(b.kind));
}

export function buildAlarmCalendar(data, { now = new Date() } = {}) {
  const stamp = utcStamp(now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CuidaLocal//Alarmes locais//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:CuidaLocal',
  ];

  for (const item of data?.collections?.agenda || []) {
    if (item.concluido || !validDate(item.data) || !validTime(item.hora)) continue;
    const startDate = new Date(`${item.data}T${item.hora}:00`);
    if (Number.isNaN(startDate.getTime()) || startDate < now) continue;
    lines.push(...eventBlock({
      uid: `agenda-${uidPart(item.id)}`,
      start: `${compactDate(item.data)}T${compactTime(item.hora)}`,
      summary: item.titulo || 'Compromisso',
      description: item.observacoes || 'Compromisso cadastrado no CuidaLocal.',
      stamp,
    }));
  }

  const nowParts = localDateParts(now);
  for (const item of data?.collections?.medicamentos || []) {
    if (item.ativo === false) continue;
    for (const time of item.horarios || []) {
      if (!validTime(time)) continue;
      const startDay = time <= nowParts.time ? addLocalDays(now, 1) : now;
      const startDate = localDateParts(startDay).date;
      const name = item.nome || 'Medicamento cadastrado';
      lines.push(...eventBlock({
        uid: `med-${uidPart(item.id)}-${time.replace(':', '')}`,
        start: `${compactDate(startDate)}T${compactTime(time)}`,
        summary: `Horário cadastrado: ${name}`,
        description: 'Confira a orientação profissional recebida. O CuidaLocal não define medicamentos, doses ou horários.',
        stamp,
        repeat: true,
      }));
    }
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
