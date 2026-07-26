import {
  createEmptyData,
  validateBackup,
  normalizeImportedData,
  buildDailyOverview,
  calculateExpenseSummary,
  collectionToCsv,
  CSV_FIELDS,
  parseMedicationTimes,
  pruneMedicationRecords,
  upsertMedicationRecord,
} from './core.mjs';
import {
  readUiMode,
  writeUiMode,
  isSimpleRoute,
  phoneHref,
} from './ui-mode.mjs';

import {
  buildAlarmCalendar,
  buildNativeAlarmPlan,
  collectDueReminders,
} from './alarms.mjs';
import { appLocale, isEnglishApp, localizeHtml, localizeText } from './i18n.mjs';

const english = isEnglishApp(document);
const t = value => localizeText(value, english);
const th = value => localizeHtml(value, english);

const STORAGE_KEY = 'cuidalocal:v2:data';
const ALARM_ENABLED_KEY = 'cuidalocal:v2:alarms-enabled';
const ALARM_HISTORY_KEY = 'cuidalocal:v2:alarm-history';
const NATIVE_ALARM_CHANNEL = 'cuidalocal-alarmes';
const titles = {
  painel: 'Painel diário', agenda: 'Agenda', medicamentos: 'Medicamentos', diario: 'Diário de cuidados',
  despesas: 'Despesas', contatos: 'Contatos', emergencia: 'Cartão de emergência', dados: 'Dados e backup',
};
const simpleTitles = {
  painel: 'Início', agenda: 'Meu dia', medicamentos: 'Medicamentos', contatos: 'Pessoas para ligar', emergencia: 'Ajuda e emergência',
};
const el = id => document.getElementById(id);
const main = el('conteudo');
let data = loadData();
let route = location.hash.replace('#/', '') || 'painel';
let selectedDate = todayISO();
let deferredInstallPrompt = null;
let uiMode = readUiMode();
let offlineReady = false;
let currentAlarmReminders = [];
let alarmAudioContext = null;
let nativeAlarmSyncPending = false;

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function uid() { return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function nowISO() { return new Date().toISOString(); }
function esc(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function fmtDate(value) {
  if (!value) return '—';
  const [y, m, d] = value.split('-');
  if (!y || !m || !d) return value;
  return new Intl.DateTimeFormat(appLocale(english), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}
function fmtMoney(value) { return Number(value || 0).toLocaleString(appLocale(english), { style: 'currency', currency: 'BRL' }); }
function initials(name) { return String(name || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function labelStatus(status) { return t(({ administrado: 'Administrado', nao_realizado: 'Não realizado', adiado: 'Adiado', pendente: 'Pendente' })[status] || status); }

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyData();
    const parsed = JSON.parse(raw);
    return validateBackup(parsed).valid ? normalizeImportedData(parsed) : createEmptyData();
  } catch { return createEmptyData(); }
}
function saveData(message = 'Alterações salvas') {
  try {
    data.meta.updatedAt = nowISO();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    syncNativeAlarms();
    el('save-state').textContent = 'Salvo agora neste dispositivo';
    toast(message);
    setTimeout(() => { el('save-state').textContent = 'Salvo neste dispositivo'; }, 1800);
  } catch { toast('Não foi possível salvar. Verifique o espaço do navegador.', true); }
}
function toast(message, error = false) {
  const node = document.createElement('div');
  node.className = `toast${error ? ' error' : ''}`;
  node.textContent = t(message);
  el('toast-region').append(node);
  setTimeout(() => node.remove(), 3200);
}
function download(filename, content, type) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function localNotificationsPlugin() { return globalThis.Capacitor?.Plugins?.LocalNotifications || null; }
function isNativeAlarmApp() { return Boolean(localNotificationsPlugin()); }
function alarmsEnabled() {
  try { return localStorage.getItem(ALARM_ENABLED_KEY) === 'true'; }
  catch { return false; }
}
function setAlarmsEnabled(value) {
  try { localStorage.setItem(ALARM_ENABLED_KEY, String(Boolean(value))); }
  catch { /* The current session can still show a reminder. */ }
}
function readAlarmHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ALARM_HISTORY_KEY) || '{}');
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    return Object.fromEntries(Object.entries(parsed).filter(([, timestamp]) => Number(timestamp) >= cutoff));
  } catch { return {}; }
}
function acknowledgeCurrentAlarms() {
  const history = readAlarmHistory();
  const acknowledgedAt = Date.now();
  currentAlarmReminders.forEach(item => { history[item.key] = acknowledgedAt; });
  try { localStorage.setItem(ALARM_HISTORY_KEY, JSON.stringify(history)); } catch { /* Keep working without persistence. */ }
  currentAlarmReminders = [];
  const host = el('alarm-dialog');
  host.classList.add('hidden');
  host.innerHTML = '';
  main.focus({ preventScroll: true });
}
function prepareAlarmSound() {
  try {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return;
    alarmAudioContext ||= new Context();
    alarmAudioContext.resume?.();
  } catch { /* Sound is reinforcement only. */ }
}
function playAlarmSignal() {
  navigator.vibrate?.([350, 180, 350, 180, 500]);
  if (!alarmAudioContext) return;
  for (const offset of [0, .45, .9]) {
    const oscillator = alarmAudioContext.createOscillator();
    const gain = alarmAudioContext.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(.0001, alarmAudioContext.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(.28, alarmAudioContext.currentTime + offset + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, alarmAudioContext.currentTime + offset + .28);
    oscillator.connect(gain).connect(alarmAudioContext.destination);
    oscillator.start(alarmAudioContext.currentTime + offset);
    oscillator.stop(alarmAudioContext.currentTime + offset + .3);
  }
}
async function showWebNotifications(reminders) {
  if (!('Notification' in globalThis) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    await Promise.all(reminders.map(item => registration.showNotification(item.kind === 'medicamento' ? `Medicamento — ${item.time}` : `Compromisso — ${item.time}`, {
      body: `${item.title}. ${item.body}`,
      tag: item.key,
      renotify: true,
      requireInteraction: true,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { route: item.kind === 'medicamento' ? 'medicamentos' : 'agenda' },
    })));
  } catch { /* The in-app alert remains available. */ }
}
function showDueAlarm(reminders) {
  if (!reminders.length || currentAlarmReminders.length) return;
  currentAlarmReminders = reminders;
  const host = el('alarm-dialog');
  host.innerHTML = th(`<section class="alarm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="alarm-dialog-title" aria-describedby="alarm-dialog-copy">
    <div class="alarm-symbol" aria-hidden="true">⏰</div>
    <p class="alarm-now">${reminders.some(item => item.lateMinutes > 0) ? 'LEMBRETE PENDENTE' : 'AGORA'}</p>
    <h2 id="alarm-dialog-title">${reminders.length === 1 ? esc(reminders[0].title) : `${reminders.length} lembretes`}</h2>
    <div id="alarm-dialog-copy" class="alarm-items">${reminders.map(item => `<article><strong>${esc(item.time)} — ${esc(item.kind === 'medicamento' ? 'Medicamento cadastrado' : 'Compromisso')}</strong><span>${esc(item.title)}</span><p>${esc(item.body)}</p>${item.lateMinutes ? `<small>Atrasado ${item.lateMinutes} minuto(s).</small>` : ''}</article>`).join('')}</div>
    <button class="alarm-acknowledge" data-action="alarm-acknowledge">Entendi</button>
    <button class="alarm-help" data-route-go="emergencia">Preciso de ajuda</button>
  </section>`);
  host.classList.remove('hidden');
  host.querySelector('.alarm-acknowledge')?.focus();
  playAlarmSignal();
  showWebNotifications(reminders);
}
function checkDueAlarms() {
  if (!alarmsEnabled() || !data.settings.onboardingComplete || currentAlarmReminders.length) return;
  const history = readAlarmHistory();
  const reminders = collectDueReminders(data, { acknowledgedKeys: new Set(Object.keys(history)), lookbackMinutes: 15 });
  showDueAlarm(reminders);
}
function alarmPanel(simple = false) {
  const count = buildNativeAlarmPlan(data).length;
  const enabled = alarmsEnabled();
  const native = isNativeAlarmApp();
  return `<section class="${simple ? 'simple-alarm-panel' : 'card span-12 alarm-panel'}" aria-labelledby="alarm-panel-title">
    <div><span class="alarm-panel-icon" aria-hidden="true">⏰</span><h3 id="alarm-panel-title">Alarmes e lembretes</h3></div>
    <p>${native ? 'O aplicativo Android pode avisar mesmo fechado e sem internet.' : 'Enquanto esta PWA estiver aberta, ela mostra e toca os lembretes ativados.'}</p>
    <div class="alarm-panel-actions">
      <button class="${simple ? 'simple-alarm-button' : 'button primary'}" data-action="alarm-enable">${enabled ? 'Atualizar alarmes' : 'Ativar alarmes'}</button>
      ${enabled ? `<button class="${simple ? 'simple-alarm-button secondary' : 'button secondary'}" data-action="alarm-disable">Desativar alarmes</button>` : ''}
      ${native ? '' : `<button class="${simple ? 'simple-alarm-button secondary' : 'button secondary'}" data-action="alarm-calendar-export">Adicionar ao calendário do aparelho</button>`}
    </div>
    <p class="alarm-persistent-copy">${native
      ? `<strong>${count} alarme(s) local(is) programado(s).</strong> Eles são atualizados ao salvar, editar ou excluir horários. Mantenha as permissões do Android ativas.`
      : `<strong>${count} alarme(s) com horário cadastrado.</strong> Os alarmes do calendário continuam mesmo com o CuidaLocal fechado. Ao alterar ou excluir horários, importe novamente e substitua o calendário “CuidaLocal”.`}</p>
  </section>`;
}
async function syncNativeAlarms() {
  const plugin = localNotificationsPlugin();
  if (!plugin || !alarmsEnabled() || nativeAlarmSyncPending) return;
  nativeAlarmSyncPending = true;
  try {
    const pending = await plugin.getPending();
    if (pending.notifications?.length) await plugin.cancel({ notifications: pending.notifications.map(item => ({ id: item.id })) });
    const notifications = buildNativeAlarmPlan(data).map(item => ({
      id: item.id,
      title: item.title,
      body: item.body,
      channelId: NATIVE_ALARM_CHANNEL,
      schedule: item.schedule.at ? { at: new Date(item.schedule.at), allowWhileIdle: true } : item.schedule,
      extra: item.extra,
      ongoing: false,
      autoCancel: true,
    }));
    if (notifications.length) await plugin.schedule({ notifications });
  } catch (error) {
    toast(`Não foi possível atualizar os alarmes do Android: ${error.message || error}`, true);
  } finally { nativeAlarmSyncPending = false; }
}
async function enableAlarms() {
  prepareAlarmSound();
  const plugin = localNotificationsPlugin();
  if (plugin) {
    try {
      let permission = await plugin.checkPermissions();
      if (permission.display !== 'granted') permission = await plugin.requestPermissions();
      if (permission.display !== 'granted') throw new Error('Permissão de notificações não concedida');
      await plugin.createChannel({ id: NATIVE_ALARM_CHANNEL, name: 'Alarmes do CuidaLocal', description: 'Compromissos e horários cadastrados', importance: 5, visibility: 1, vibration: true });
      if (plugin.checkExactNotificationSetting && plugin.changeExactNotificationSetting) {
        const exact = await plugin.checkExactNotificationSetting();
        if (exact.exact_alarm !== 'granted') await plugin.changeExactNotificationSetting();
      }
      setAlarmsEnabled(true);
      await syncNativeAlarms();
      toast('Alarmes persistentes ativados no Android');
      render();
      return;
    } catch (error) { toast(`Não foi possível ativar: ${error.message || error}`, true); return; }
  }
  let notificationGranted = false;
  if ('Notification' in globalThis) {
    try { notificationGranted = (await Notification.requestPermission()) === 'granted'; } catch { /* Continue with visual alerts. */ }
  }
  setAlarmsEnabled(true);
  toast(notificationGranted ? 'Avisos ativados enquanto a PWA estiver aberta' : 'Lembretes visuais ativados; use o calendário para avisos com a PWA fechada');
  render();
  checkDueAlarms();
}
async function disableAlarms() {
  setAlarmsEnabled(false);
  if (currentAlarmReminders.length) acknowledgeCurrentAlarms();
  const plugin = localNotificationsPlugin();
  if (plugin) {
    try {
      const pending = await plugin.getPending();
      if (pending.notifications?.length) await plugin.cancel({ notifications: pending.notifications.map(item => ({ id: item.id })) });
    } catch (error) { toast(`Não foi possível cancelar todos os alarmes: ${error.message || error}`, true); return; }
  }
  toast('Alarmes desativados');
  render();
}
function exportAlarmCalendar() {
  const calendar = buildAlarmCalendar(data);
  if (!calendar.includes('BEGIN:VEVENT')) { toast('Cadastre ao menos um compromisso ou medicamento com horário.', true); return; }
  download('cuidalocal-alarmes.ics', calendar, 'text/calendar;charset=utf-8');
  showModal(`<div class="modal-header"><div><h2 id="modal-title">Adicionar alarmes ao calendário</h2><p class="modal-subtitle">O arquivo cuidalocal-alarmes.ics foi preparado.</p></div><button class="icon-button" data-close aria-label="Fechar">×</button></div><div class="notice info"><strong>Para funcionar com o CuidaLocal fechado:</strong><ol><li>Abra o arquivo baixado.</li><li>Escolha adicionar ou importar no calendário do aparelho.</li><li>Use um calendário chamado “CuidaLocal”.</li></ol></div><div class="notice warning" style="margin-top:16px"><strong>Se alterar ou excluir um horário:</strong><p>Remova ou substitua o calendário “CuidaLocal” e importe um arquivo novo, para não manter alarmes antigos.</p></div><div class="modal-actions"><button class="button primary" data-close>Entendi</button></div>`);
}

function emptyState(title, copy, action = '') {
  return `<div class="empty-state"><div class="empty-icon">＋</div><strong>${esc(title)}</strong><span>${esc(copy)}</span>${action ? `<div style="margin-top:14px">${action}</div>` : ''}</div>`;
}
function pageHeader(title, copy, button = '') {
  return `<div class="page-header"><div><h2>${esc(title)}</h2><p>${esc(copy)}</p></div>${button}</div>`;
}
function getItem(collection, id) { return data.collections[collection].find(item => item.id === id); }
function removalLabel(collection, item) {
  const type = ({ agenda: 'o compromisso', medicamentos: 'o medicamento', contatos: 'o contato' })[collection] || 'este registro';
  const name = String(item?.titulo || item?.nome || '').trim().slice(0, 100);
  return name ? `${type} “${name}”` : type;
}
function removeItem(collection, id) {
  const item = getItem(collection, id);
  const label = removalLabel(collection, item);
  if (!confirm(`Excluir ${label}? Esta ação não pode ser desfeita.`)) return;
  data.collections[collection] = data.collections[collection].filter(entry => entry.id !== id);
  if (collection === 'medicamentos') data.collections.registrosMedicamentos = data.collections.registrosMedicamentos.filter(item => item.medicamentoId !== id);
  saveData('Registro excluído'); render();
}

function applyUiMode() {
  const simple = uiMode === 'simple';
  document.body.classList.toggle('simple-mode', simple);
  el('safety-banner').innerHTML = th(simple
    ? '<strong>Importante.</strong> Este aplicativo organiza informações. Em caso de emergência, peça ajuda.'
    : '<strong>Ferramenta de organização.</strong> Não substitui avaliação, orientação ou atendimento de profissionais de saúde. Em emergência, procure o serviço local adequado.');
  document.querySelectorAll('[data-ui-mode]').forEach(control => {
    control.setAttribute('aria-checked', String(simple));
    control.setAttribute('aria-label', t(simple ? 'Desativar tela simples e usar tela completa' : 'Ativar tela simples'));
    const status = control.querySelector('.mode-switch-copy small');
    if (status && !control.classList.contains('onboarding-mode-switch')) status.textContent = t(simple ? 'Ligada' : 'Desligada');
  });
}

function toggleUiMode() {
  if (uiMode === 'simple' && !confirm('Abrir a tela completa, com mais opções e informações?')) return;
  uiMode = uiMode === 'simple' ? 'full' : 'simple';
  writeUiMode(undefined, uiMode);
  route = 'painel';
  selectedDate = todayISO();
  history.replaceState(null, '', '#/painel');
  applyUiMode();
  render();
  toast(uiMode === 'simple' ? 'Tela simples ativada' : 'Tela completa ativada');
}

function render() {
  const simple = uiMode === 'simple';
  if (!titles[route] || (simple && !isSimpleRoute(route))) {
    route = 'painel';
    history.replaceState(null, '', '#/painel');
  }
  applyUiMode();
  el('page-title').textContent = t(simple ? simpleTitles[route] : titles[route]);
  el('today-label').textContent = new Intl.DateTimeFormat(appLocale(english), { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());
  el('simple-home').classList.toggle('hidden', !simple || route === 'painel');
  el('simple-emergency-shortcut').classList.toggle('hidden', !simple || route === 'emergencia');
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.route === route));
  const fullViews = { painel: renderDashboard, agenda: renderAgenda, medicamentos: renderMedicamentos, diario: renderDiario, despesas: renderDespesas, contatos: renderContatos, emergencia: renderEmergency, dados: renderDados };
  const simpleViews = { painel: renderSimpleDashboard, agenda: renderSimpleAgenda, medicamentos: renderSimpleMedicamentos, contatos: renderSimpleContacts, emergencia: renderSimpleEmergency };
  main.innerHTML = th((simple ? simpleViews : fullViews)[route]());
  main.focus({ preventScroll: true });
}

function renderDashboard() {
  const overview = buildDailyOverview(data, selectedDate);
  const doneMeds = overview.medicamentos.filter(item => item.status === 'administrado').length;
  const openAgenda = overview.agenda.filter(item => !item.concluido).length;
  const dayDiary = data.collections.diario.filter(item => item.data === selectedDate).length;
  const name = data.profile.comoChamar || data.profile.nome || 'quem cuida';
  return `
    ${deferredInstallPrompt ? `<div class="install-note no-print"><span><strong>Instale o CuidaLocal</strong><br>Abra como aplicativo e tenha acesso rápido, inclusive offline.</span><button class="button secondary compact" data-action="install">Instalar</button></div>` : ''}
    <div class="cards-grid">
      ${alarmPanel(false)}
      <section class="card span-12 welcome-card"><span class="badge">VISÃO DO DIA</span><h2>Olá, ${esc(name)}.</h2><p>Aqui está o resumo de ${selectedDate === todayISO() ? 'hoje' : fmtDate(selectedDate)}. Registre somente fatos observados e orientações profissionais já recebidas.</p><label class="field" style="max-width:180px"><span style="color:#fff">Consultar outra data</span><input id="dashboard-date" type="date" value="${esc(selectedDate)}"></label></section>
      <section class="card span-12"><div class="metric-row"><div class="metric-box"><strong>${openAgenda}</strong><span>compromisso(s) pendente(s)</span></div><div class="metric-box"><strong>${doneMeds}/${overview.medicamentos.length}</strong><span>registro(s) administrativo(s)</span></div><div class="metric-box"><strong>${dayDiary}</strong><span>anotação(ões) no diário</span></div></div></section>
      <section class="card span-7"><div class="card-header"><div><h3>Agenda do dia</h3><p>Compromissos e tarefas organizacionais</p></div><button class="button ghost compact" data-route-go="agenda">Ver agenda</button></div>
        <div class="section-list">${overview.agenda.length ? overview.agenda.map(item => `<div class="list-item"><span class="time">${esc(item.hora || '—')}</span><div class="list-content"><strong>${esc(item.titulo)}</strong><p>${esc(item.local || item.tipo || '')}</p></div><span class="badge ${item.concluido ? 'done' : ''}">${item.concluido ? 'CONCLUÍDO' : 'PENDENTE'}</span></div>`).join('') : emptyState('Nenhum compromisso neste dia', 'Adicione itens na agenda para vê-los aqui.')}</div>
      </section>
      <section class="card span-5"><div class="card-header"><div><h3>Passagem de plantão</h3><p>Últimos registros do dia</p></div><button class="button ghost compact" data-action="quick-diary">Registrar</button></div>
        <div class="section-list">${data.collections.diario.filter(item => item.data === selectedDate).slice().sort((a,b)=>String(b.hora).localeCompare(String(a.hora))).slice(0,3).map(item => `<div class="list-item"><span class="time">${esc(item.hora || '—')}</span><div class="list-content"><strong>${esc(item.categoria || 'Registro')}</strong><p>${esc(item.registro)}</p></div></div>`).join('') || emptyState('Sem registros', 'Use o diário para uma passagem de plantão clara.')}</div>
      </section>
      <section class="card span-12"><div class="card-header"><div><h3>Registro administrativo de medicamentos</h3><p>Somente conforme orientação profissional previamente recebida</p></div><button class="button ghost compact" data-route-go="medicamentos">Gerenciar</button></div>
        <div class="notice warning" style="margin-bottom:15px"><strong>CuidaLocal não recomenda medicamentos, doses ou horários.</strong><p>Os itens abaixo reproduzem apenas o que foi cadastrado por você a partir de uma orientação profissional.</p></div>
        <div class="section-list">${overview.medicamentos.length ? overview.medicamentos.map(item => `<div class="list-item"><span class="time">${esc(item.hora)}</span><div class="list-content"><strong>${esc(item.nome)}</strong><p>${esc(item.orientacao || 'Consulte a orientação profissional cadastrada.')}</p></div><span class="badge ${item.status === 'administrado' ? 'done' : item.status !== 'pendente' ? 'warning' : ''}">${esc(labelStatus(item.status).toUpperCase())}</span><div class="list-actions">${item.status === 'pendente' ? `<button class="button secondary compact" data-register="${esc(item.medicamentoId)}" data-time="${esc(item.hora)}">Registrar</button>` : `<button class="button ghost compact" data-register="${esc(item.medicamentoId)}" data-time="${esc(item.hora)}">Revisar</button>`}</div></div>`).join('') : emptyState('Nenhum horário cadastrado', 'Cadastre somente informações fornecidas por um profissional.', '<button class="button secondary compact" data-route-go="medicamentos">Cadastrar</button>')}</div>
      </section>
    </div>`;
}

function renderSimpleDashboard() {
  const overview = buildDailyOverview(data, todayISO());
  const name = data.profile.comoChamar || data.profile.nome || '';
  const next = overview.agenda.find(item => !item.concluido) || overview.agenda[0];
  const pending = overview.medicamentos.filter(item => item.status === 'pendente').length;
  return `<div class="simple-dashboard">
    <section class="simple-greeting" aria-labelledby="simple-greeting-title">
      <p class="simple-kicker">${new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p>
      <h2 id="simple-greeting-title">${name ? `Olá, ${esc(name)}.` : 'Olá.'}</h2>
      <p>Escolha uma opção abaixo.<span class="simple-reassurance"> Você pode voltar ao início a qualquer momento.</span></p>
    </section>
    ${alarmPanel(true)}
    <nav class="simple-action-grid" aria-label="Ações principais da tela simples">
      <button class="simple-action" data-route-go="agenda"><span class="simple-icon" aria-hidden="true">▣</span><span><strong>Meu dia</strong><small>Ver ou cadastrar compromissos</small></span></button>
      <button class="simple-action" data-route-go="medicamentos"><span class="simple-icon" aria-hidden="true">＋</span><span><strong>Medicamentos</strong><small>Ver ou cadastrar medicamentos</small></span></button>
      <button class="simple-action" data-route-go="contatos"><span class="simple-icon" aria-hidden="true">☎</span><span><strong>Pessoas para ligar</strong><small>Ligar ou cadastrar contatos</small></span></button>
      <button class="simple-action emergency" data-route-go="emergencia"><span class="simple-icon" aria-hidden="true">!</span><span><strong>Ajuda e emergência</strong><small>Abrir contatos e informações importantes</small></span></button>
    </nav>
    <section class="simple-summary" aria-labelledby="simple-summary-title">
      <h3 id="simple-summary-title">Resumo de hoje</h3>
      <div class="simple-summary-grid">
        <div><span class="simple-summary-icon" aria-hidden="true">▣</span><p><strong>${next ? `${esc(next.hora || 'Sem horário')} — ${esc(next.titulo)}` : 'Nenhum compromisso cadastrado'}</strong><span>${next?.local ? esc(next.local) : 'Consulte a tela “Meu dia” para mais detalhes.'}</span></p></div>
        <div><span class="simple-summary-icon" aria-hidden="true">＋</span><p><strong>${overview.medicamentos.length} horário(s) cadastrado(s)</strong><span>${overview.medicamentos.length ? `${pending} sem confirmação hoje.` : 'Nenhum horário para mostrar hoje.'}</span></p></div>
      </div>
    </section>
  </div>`;
}

function renderSimpleAgenda() {
  const items = data.collections.agenda
    .filter(item => item.data === todayISO())
    .slice()
    .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));
  return `<div class="simple-page">
    <header class="simple-page-header"><span class="simple-page-icon" aria-hidden="true">▣</span><div><h2>Meu dia</h2><p>Compromissos cadastrados para hoje.</p></div></header>
    <button class="simple-add-button" data-add="agenda"><span aria-hidden="true">＋</span>Cadastrar compromisso</button>
    <section class="simple-list" aria-label="Compromissos de hoje">${items.length ? items.map(item => `<article class="simple-list-card"><time>${esc(item.hora || 'Sem horário')}</time><div><h3>${esc(item.titulo)}</h3>${item.local ? `<p>${esc(item.local)}</p>` : ''}<strong class="simple-status">${item.concluido ? 'Concluído' : 'Ainda não concluído'}</strong><div class="simple-item-actions"><button aria-label="Editar compromisso ${esc(item.titulo)}" data-edit="agenda:${esc(item.id)}">Editar</button><button class="delete" aria-label="Excluir compromisso ${esc(item.titulo)}" data-delete="agenda:${esc(item.id)}">Excluir</button></div></div></article>`).join('') : `<div class="simple-empty"><span aria-hidden="true">✓</span><h3>Nada marcado para hoje</h3><p>Use o botão “Cadastrar compromisso” para adicionar uma entrada.</p></div>`}</section>
  </div>`;
}

function renderSimpleMedicamentos() {
  const items = data.collections.medicamentos.slice().sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
  return `<div class="simple-page">
    <header class="simple-page-header"><span class="simple-page-icon" aria-hidden="true">＋</span><div><h2>Medicamentos</h2><p>Cadastre somente informações recebidas de um profissional.</p></div></header>
    <button class="simple-add-button" data-add="medicamentos"><span aria-hidden="true">＋</span>Cadastrar medicamento</button>
    <div class="simple-safety" role="note"><strong>Não use esta tela para decidir o que tomar.</strong><span>Se houver dúvida, fale com a pessoa responsável ou com um profissional de saúde.</span></div>
    <section class="simple-list" aria-label="Medicamentos cadastrados">${items.length ? items.map(item => `<article class="simple-list-card medication"><span class="simple-medication-icon" aria-hidden="true">＋</span><div><h3>${esc(item.nome)}</h3><p><strong>Horários cadastrados:</strong> ${item.horarios?.length ? item.horarios.map(esc).join(', ') : 'Nenhum horário informado'}</p><p>${esc(item.orientacao || 'Orientação não informada. Consulte a pessoa responsável.')}</p><strong class="simple-status">${item.ativo === false ? 'Cadastro pausado' : 'Cadastro ativo'}</strong><div class="simple-item-actions"><button aria-label="Editar medicamento ${esc(item.nome)}" data-edit="medicamentos:${esc(item.id)}">Editar</button><button class="delete" aria-label="Excluir medicamento ${esc(item.nome)}" data-delete="medicamentos:${esc(item.id)}">Excluir</button></div></div></article>`).join('') : `<div class="simple-empty"><span aria-hidden="true">＋</span><h3>Nenhum medicamento cadastrado</h3><p>Use o botão “Cadastrar medicamento” somente para transcrever uma orientação profissional.</p></div>`}</section>
  </div>`;
}

function renderSimpleContacts() {
  const items = data.collections.contatos.slice().sort((a, b) => (Number(b.favorito) - Number(a.favorito)) || String(a.nome).localeCompare(String(b.nome)));
  return `<div class="simple-page">
    <header class="simple-page-header"><span class="simple-page-icon" aria-hidden="true">☎</span><div><h2>Pessoas para ligar</h2><p>Cadastre contatos importantes ou toque em “Ligar”.</p></div></header>
    <button class="simple-add-button" data-add="contatos"><span aria-hidden="true">＋</span>Cadastrar contato</button>
    ${data.settings.demoLoaded ? '<div class="simple-safety" role="note"><strong>Estes contatos são fictícios.</strong><span>Não é possível ligar usando os dados de demonstração.</span></div>' : ''}
    <section class="simple-contact-list" aria-label="Contatos importantes">${items.length ? items.map(item => {
      const href = data.settings.demoLoaded ? '' : phoneHref(item.telefone);
      return `<article class="simple-contact-card"><span class="simple-avatar" aria-hidden="true">${esc(initials(item.nome))}</span><div><h3>${esc(item.nome)}</h3><p>${esc(item.relacao || 'Contato importante')}</p><strong>${esc(item.telefone || 'Telefone não informado')}</strong><div class="simple-item-actions"><button aria-label="Editar contato ${esc(item.nome)}" data-edit="contatos:${esc(item.id)}">Editar</button><button class="delete" aria-label="Excluir contato ${esc(item.nome)}" data-delete="contatos:${esc(item.id)}">Excluir</button></div></div>${href ? `<a class="simple-call" href="${esc(href)}" aria-label="Ligar para ${esc(item.nome)}"><span aria-hidden="true">☎</span><span>Ligar</span></a>` : '<span class="simple-call unavailable">Sem ligação</span>'}</article>`;
    }).join('') : `<div class="simple-empty"><span aria-hidden="true">☎</span><h3>Nenhum contato cadastrado</h3><p>Use o botão “Cadastrar contato” para adicionar uma pessoa.</p></div>`}</section>
  </div>`;
}

function renderSimpleEmergency() {
  const e = data.emergency;
  const contacts = [
    { name: e.contato1Nome, phone: e.contato1Telefone, label: 'Contato principal' },
    { name: e.contato2Nome, phone: e.contato2Telefone, label: 'Contato alternativo' },
  ].filter(item => item.name || item.phone);
  return `<div class="simple-page simple-emergency-page">
    <header class="simple-page-header emergency"><span class="simple-page-icon" aria-hidden="true">!</span><div><h2>Ajuda e emergência</h2><p>Use os contatos abaixo para pedir ajuda.</p></div></header>
    <div class="simple-urgent" role="alert"><strong>Se você estiver em perigo agora</strong><span>Use o telefone para ligar para o serviço de emergência da sua região.</span></div>
    ${data.settings.demoLoaded ? '<div class="simple-safety" role="note"><strong>Dados de demonstração.</strong><span>Os números abaixo são fictícios e não fazem ligações.</span></div>' : ''}
    <section class="simple-contact-list" aria-label="Contatos de emergência">${contacts.length ? contacts.map(item => {
      const href = data.settings.demoLoaded ? '' : phoneHref(item.phone);
      return `<article class="simple-contact-card emergency-contact"><span class="simple-avatar" aria-hidden="true">!</span><div><p>${esc(item.label)}</p><h3>${esc(item.name || 'Contato')}</h3><strong>${esc(item.phone || 'Telefone não informado')}</strong></div>${href ? `<a class="simple-call emergency-call" href="${esc(href)}" aria-label="Ligar para ${esc(item.name || 'contato de emergência')}"><span aria-hidden="true">☎</span><span>Ligar agora</span></a>` : '<span class="simple-call unavailable">Sem ligação</span>'}</article>`;
    }).join('') : `<div class="simple-empty warning"><span aria-hidden="true">!</span><h3>Nenhum contato de emergência cadastrado</h3><p>Peça a uma pessoa de confiança para configurar o cartão na tela completa.</p></div>`}</section>
    <section class="simple-info-card" aria-labelledby="simple-card-title"><h3 id="simple-card-title">Minhas informações importantes</h3><dl><div><dt>Nome</dt><dd>${esc(e.comoChamar || e.nome || 'Não informado')}</dd></div><div><dt>Alergias informadas</dt><dd>${esc(e.alergias || 'Não informado')}</dd></div><div><dt>Condições importantes</dt><dd>${esc(e.condicoesImportantes || 'Não informado')}</dd></div><div><dt>Medicamentos em uso</dt><dd>${esc(e.medicamentosEmUso || 'Não informado')}</dd></div></dl></section>
  </div>`;
}

function renderAgenda() {
  const items = data.collections.agenda.slice().sort((a,b)=>`${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
  return `${pageHeader('Agenda', 'Centralize consultas, exames, visitas, tarefas e lembretes.', '<button class="button primary" data-add="agenda">+ Novo compromisso</button>')}
  <div class="toolbar"><label class="field search"><span>Buscar</span><input data-filter="agenda" placeholder="Buscar por título, local ou observação"></label><button class="button secondary" data-action="print">Imprimir</button></div>
  <section class="card">${items.length ? `<div class="table-wrap"><table><thead><tr><th>Data e hora</th><th>Compromisso</th><th>Tipo / local</th><th>Status</th><th class="no-print">Ações</th></tr></thead><tbody id="agenda-rows">${items.map(item => `<tr data-search="${esc(`${item.titulo} ${item.local} ${item.observacoes}`.toLowerCase())}"><td><strong>${fmtDate(item.data)}</strong><br>${esc(item.hora || 'Sem horário')}</td><td><strong>${esc(item.titulo)}</strong><br><span class="muted">${esc(item.observacoes || '')}</span></td><td>${esc(item.tipo || '—')}<br><span class="muted">${esc(item.local || '')}</span></td><td><span class="badge ${item.concluido ? 'done' : ''}">${item.concluido ? 'CONCLUÍDO' : 'PENDENTE'}</span></td><td class="no-print"><div class="list-actions"><button class="button ghost compact" data-toggle-agenda="${esc(item.id)}">${item.concluido ? 'Reabrir' : 'Concluir'}</button><button class="button secondary compact" data-edit="agenda:${esc(item.id)}">Editar</button><button class="button ghost compact" data-delete="agenda:${esc(item.id)}">Excluir</button></div></td></tr>`).join('')}</tbody></table></div>` : emptyState('Agenda vazia', 'Crie o primeiro compromisso para organizar a rotina.')}</section>`;
}

function renderMedicamentos() {
  const items = data.collections.medicamentos;
  return `${pageHeader('Medicamentos', 'Cadastre e registre administrativamente somente conforme orientação profissional.', '<button class="button primary" data-add="medicamentos">+ Cadastrar medicamento</button>')}
  <div class="notice warning" style="margin-bottom:18px"><strong>Segurança em primeiro lugar.</strong><p>Esta área não prescreve, não calcula doses, não verifica interações e não substitui bula, receita ou profissional. Em caso de dúvida, não use o app para decidir: consulte o profissional responsável.</p></div>
  <div class="cards-grid">${items.length ? items.map(item => `<section class="card span-6"><div class="card-header"><div><span class="badge ${item.ativo ? '' : 'warning'}">${item.ativo ? 'ATIVO' : 'INATIVO'}</span><h3 style="margin-top:9px">${esc(item.nome)}</h3><p>${esc(item.apresentacao || 'Apresentação não informada')}</p></div></div><div class="notice info"><strong>Orientação cadastrada</strong><p>${esc(item.orientacao || 'Não informada. Consulte o profissional responsável.')}</p></div><p><strong>Horários informados:</strong> ${item.horarios?.length ? item.horarios.map(h=>`<span class="badge">${esc(h)}</span>`).join(' ') : 'Nenhum'}</p><p class="muted"><strong>Profissional/referência:</strong> ${esc(item.profissional || 'Não informado')}</p><div class="list-actions no-print" style="justify-content:flex-start"><button class="button secondary compact" data-edit="medicamentos:${esc(item.id)}">Editar</button><button class="button ghost compact" data-delete="medicamentos:${esc(item.id)}">Excluir</button></div></section>`).join('') : `<section class="card span-12">${emptyState('Nenhum medicamento cadastrado', 'Transcreva apenas as informações da orientação profissional já recebida.')}</section>`}</div>`;
}

function renderDiario() {
  const items = data.collections.diario.slice().sort((a,b)=>`${b.data}${b.hora}`.localeCompare(`${a.data}${a.hora}`));
  return `${pageHeader('Diário de cuidados', 'Registre fatos observados e facilite uma passagem de plantão objetiva.', '<button class="button primary" data-add="diario">+ Novo registro</button>')}
  <div class="toolbar"><label class="field search"><span>Buscar no diário</span><input data-filter="diario" placeholder="Buscar texto, categoria ou responsável"></label><button class="button secondary" data-action="print">Imprimir</button></div>
  <section class="card"><div class="notice info" style="margin-bottom:18px"><strong>Prefira fatos objetivos.</strong><p>Exemplo: “Aceitou o almoço às 12h” em vez de interpretações clínicas. Para sintomas ou intercorrências, procure orientação profissional.</p></div><div class="section-list" id="diario-rows">${items.length ? items.map(item => `<article class="list-item" data-search="${esc(`${item.registro} ${item.categoria} ${item.responsavel}`.toLowerCase())}"><span class="time">${esc(item.hora || '—')}</span><div class="list-content"><span class="badge ${item.prioridade === 'atenção' ? 'warning' : ''}">${esc((item.categoria || 'REGISTRO').toUpperCase())}</span><strong style="margin-top:7px">${fmtDate(item.data)}${item.responsavel ? ` • ${esc(item.responsavel)}` : ''}</strong><p>${esc(item.registro)}</p></div><div class="list-actions no-print"><button class="button secondary compact" data-edit="diario:${esc(item.id)}">Editar</button><button class="button ghost compact" data-delete="diario:${esc(item.id)}">Excluir</button></div></article>`).join('') : emptyState('Diário vazio', 'Adicione o primeiro registro da rotina de cuidados.')}</div></section>`;
}

function renderDespesas() {
  const month = selectedDate.slice(0,7);
  const items = data.collections.despesas.slice().sort((a,b)=>String(b.data).localeCompare(String(a.data)));
  const summary = calculateExpenseSummary(items, month);
  const max = Math.max(...Object.values(summary.porCategoria), 1);
  return `${pageHeader('Despesas', 'Acompanhe gastos relacionados à rotina, sem conexão bancária.', '<button class="button primary" data-add="despesas">+ Nova despesa</button>')}
  <div class="cards-grid"><section class="card span-4"><div class="card-header"><div><h3>Total no mês</h3><p>${fmtDate(`${month}-01`).slice(3)}</p></div></div><div class="metric">${fmtMoney(summary.total)}</div></section><section class="card span-8"><div class="card-header"><div><h3>Por categoria</h3><p>Distribuição do mês selecionado</p></div></div>${Object.entries(summary.porCategoria).length ? Object.entries(summary.porCategoria).map(([cat,total])=>`<div><small>${esc(cat)} — ${fmtMoney(total)}</small><div class="category-bar"><span style="width:${Math.round(total/max*100)}%"></span></div></div>`).join('') : '<span class="muted">Sem despesas neste mês.</span>'}</section><section class="card span-12">${items.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Pagamento</th><th>Valor</th><th class="no-print">Ações</th></tr></thead><tbody>${items.map(item=>`<tr><td>${fmtDate(item.data)}</td><td><strong>${esc(item.descricao)}</strong><br><span class="muted">${esc(item.observacoes || '')}</span></td><td>${esc(item.categoria)}</td><td>${esc(item.formaPagamento || '—')}</td><td class="money">${fmtMoney(item.valor)}</td><td class="no-print"><div class="list-actions"><button class="button secondary compact" data-edit="despesas:${esc(item.id)}">Editar</button><button class="button ghost compact" data-delete="despesas:${esc(item.id)}">Excluir</button></div></td></tr>`).join('')}</tbody></table></div>` : emptyState('Nenhuma despesa', 'Registre gastos para acompanhar o total mensal.')}</section></div>`;
}

function renderContatos() {
  const items = data.collections.contatos.slice().sort((a,b)=>(Number(b.favorito)-Number(a.favorito)) || String(a.nome).localeCompare(String(b.nome)));
  return `${pageHeader('Contatos', 'Mantenha referências importantes disponíveis mesmo sem internet.', '<button class="button primary" data-add="contatos">+ Novo contato</button>')}
  <div class="contact-grid">${items.length ? items.map(item=>`<article class="card contact-card"><div class="avatar">${esc(initials(item.nome))}</div><h3>${esc(item.nome)} ${item.favorito ? '<span title="Favorito">★</span>' : ''}</h3><p>${esc(item.relacao || 'Relação não informada')}</p><p><strong>${esc(item.telefone || 'Telefone não informado')}</strong></p><p>${esc(item.email || '')}</p><div class="list-actions no-print"><button class="button secondary compact" data-edit="contatos:${esc(item.id)}">Editar</button><button class="button ghost compact" data-delete="contatos:${esc(item.id)}">Excluir</button></div></article>`).join('') : `<section class="card">${emptyState('Nenhum contato', 'Adicione familiares, profissionais e serviços importantes.')}</section>`}</div>`;
}

function emergencyPreview() {
  const e = data.emergency;
  const field = (label, value, full='') => `<div class="emergency-field ${full}"><span>${label}</span><strong>${esc(value || 'Não informado')}</strong></div>`;
  return `<article class="emergency-card" id="emergency-print"><div class="emergency-head"><div><h2>Cartão de emergência</h2><small>Informações declaradas pelo responsável</small></div><div class="emergency-mark">CUIDALOCAL</div></div><div class="emergency-grid">${field('Nome', e.nome)}${field('Como prefere ser chamado(a)', e.comoChamar)}${field('Data de nascimento', fmtDate(e.dataNascimento))}${field('Tipo sanguíneo (se confirmado)', e.tipoSanguineo)}${field('Alergias informadas', e.alergias, 'full')}${field('Condições importantes informadas', e.condicoesImportantes, 'full')}${field('Medicamentos em uso — conforme informado', e.medicamentosEmUso, 'full')}${field('Contato principal', `${e.contato1Nome || ''} ${e.contato1Telefone || ''}`)}${field('Contato alternativo', `${e.contato2Nome || ''} ${e.contato2Telefone || ''}`)}${field('Profissional/referência', `${e.profissionalNome || ''} ${e.profissionalTelefone || ''}`, 'full')}${field('Observações', e.observacoes, 'full')}</div><p class="emergency-footer">Este cartão é informativo, pode estar desatualizado e não substitui documentos, avaliação ou orientação profissional. Atualizado localmente em: ${data.meta.updatedAt ? new Date(data.meta.updatedAt).toLocaleDateString('pt-BR') : '—'}</p></article>`;
}
function renderEmergency() {
  return `${pageHeader('Cartão de emergência', 'Preencha, revise e imprima uma referência rápida para situações importantes.', '<div style="display:flex;gap:8px"><button class="button secondary" data-action="edit-emergency">Editar cartão</button><button class="button primary" data-action="print">Imprimir</button></div>')}
  <div class="notice warning no-print" style="margin-bottom:20px"><strong>Revise antes de imprimir.</strong><p>Inclua apenas informações confirmadas. Este cartão não substitui documentos oficiais, atendimento ou prontuário profissional.</p></div>${emergencyPreview()}`;
}

function renderDados() {
  const counts = Object.values(data.collections).reduce((sum, items)=>sum+items.length,0);
  return `${pageHeader('Dados e backup', 'Você controla seus dados. Nada é enviado a um servidor.', '')}
  <div class="notice info" style="margin-bottom:18px"><strong>Armazenamento local e privado</strong><p>Há ${counts} registro(s) neste navegador. Faça backups regulares: limpar dados do navegador ou perder o aparelho pode apagar tudo.</p></div>
  <div class="backup-grid"><section class="action-card"><h3>Backup completo (JSON)</h3><p>Salva uma cópia de todas as áreas para restaurar depois neste app.</p><button class="button primary" data-action="backup-export">Exportar backup</button></section><section class="action-card"><h3>Restaurar backup</h3><p>Importe um arquivo JSON do CuidaLocal. O conteúdo atual será substituído após confirmação.</p><button class="button secondary" data-action="backup-import">Escolher arquivo</button></section><section class="action-card"><h3>Planilha (CSV)</h3><p>Exporte uma área para abrir em aplicativos de planilha.</p><label class="field"><span>Área</span><select id="csv-collection"><option value="agenda">Agenda</option><option value="medicamentos">Medicamentos</option><option value="registrosMedicamentos">Registros de medicamentos</option><option value="diario">Diário</option><option value="despesas">Despesas</option><option value="contatos">Contatos</option></select></label><button class="button secondary" style="margin-top:10px" data-action="csv-export">Exportar CSV</button></section><section class="action-card"><h3>Impressão</h3><p>Imprima a tela atual ou salve em PDF usando a opção do navegador.</p><button class="button secondary" data-action="print">Imprimir esta tela</button></section><section class="action-card danger-zone" style="grid-column:1/-1"><h3>Apagar dados deste navegador</h3><p>Remove permanentemente todos os registros e reinicia o onboarding. Exporte um backup antes, se necessário.</p><button class="button danger" data-action="clear-data">Apagar tudo</button></section></div>`;
}

const formDefinitions = {
  agenda: { title: 'Compromisso', fields: [
    ['titulo','Título','text','Ex.: Consulta de acompanhamento',true], ['tipo','Tipo','select',['Consulta','Exame','Visita','Tarefa','Outro']], ['data','Data','date','',true], ['hora','Horário','time'], ['local','Local','text','Ex.: Clínica ou endereço'], ['observacoes','Observações','textarea','Informações organizacionais importantes'], ['concluido','Marcar como concluído','checkbox'] ] },
  medicamentos: { title: 'Medicamento', fields: [
    ['nome','Nome conforme orientação','text','Transcreva o nome',true], ['apresentacao','Apresentação informada','text','Ex.: conforme rótulo/receita'], ['orientacao','Orientação profissional recebida','textarea','Transcreva sem interpretar ou modificar',true], ['horarios','Horários informados','text','Ex.: 08:00, 20:00'], ['profissional','Profissional ou referência','text','Nome ou serviço que orientou'], ['observacoes','Observações administrativas','textarea','Não inclua recomendações próprias'], ['ativo','Cadastro ativo','checkbox'] ] },
  diario: { title: 'Registro no diário', fields: [
    ['data','Data','date','',true], ['hora','Horário','time'], ['categoria','Categoria','select',['Rotina','Alimentação','Higiene','Humor observado','Sono','Intercorrência','Passagem de plantão','Outro']], ['responsavel','Responsável pelo registro','text','Ex.: Cuidador(a) do turno'], ['registro','Fato observado','textarea','Descreva de forma objetiva',true], ['prioridade','Sinalização','select',['normal','atenção']] ] },
  despesas: { title: 'Despesa', fields: [
    ['data','Data','date','',true], ['categoria','Categoria','select',['Medicamentos','Consultas','Transporte','Alimentação','Materiais','Serviços','Outros']], ['descricao','Descrição','text','Ex.: Transporte para consulta',true], ['valor','Valor (R$)','number','0,00',true], ['formaPagamento','Forma de pagamento','select',['Dinheiro','Cartão','Transferência','Outro']], ['observacoes','Observações','textarea'] ] },
  contatos: { title: 'Contato', fields: [
    ['nome','Nome','text','Ex.: Contato familiar',true], ['relacao','Relação / função','text','Ex.: Familiar ou profissional'], ['telefone','Telefone','tel','(00) 00000-0000'], ['email','E-mail','email','nome@exemplo.com'], ['observacoes','Observações','textarea'], ['favorito','Contato favorito','checkbox'] ] },
};
const simpleFormDefinitions = {
  agenda: { title: 'Compromisso', fields: [
    ['titulo','O que vai acontecer','text','Ex.: Consulta ou visita',true], ['data','Data','date','',true], ['hora','Horário','time'], ['observacoes','Detalhes (opcional)','textarea','Ex.: endereço ou o que levar'] ] },
  medicamentos: { title: 'Medicamento', fields: [
    ['nome','Nome do medicamento','text','Copie o nome da orientação profissional',true], ['horarios','Horários','text','Ex.: 08:00, 20:00',true] ] },
  contatos: { title: 'Contato', fields: [
    ['nome','Nome','text','Nome da pessoa',true], ['relacao','Quem é essa pessoa','text','Ex.: filha, vizinho ou médico'], ['telefone','Telefone','tel','(00) 00000-0000',true] ] },
};
function fieldHTML([name, label, type, optionsOrPlaceholder = '', required = false], item) {
  const raw = item?.[name];
  if (type === 'checkbox') return `<label class="check-row full"><input type="checkbox" name="${name}" ${raw ? 'checked' : ''}><span><strong>${label}</strong></span></label>`;
  if (type === 'select') return `<label class="field"><span>${label}${required?' *':''}</span><select name="${name}" ${required?'required':''}>${optionsOrPlaceholder.map(option=>`<option value="${esc(option)}" ${raw===option?'selected':''}>${esc(option === 'normal' ? 'Normal' : option === 'atenção' ? 'Atenção' : option)}</option>`).join('')}</select></label>`;
  if (type === 'textarea') return `<label class="field full"><span>${label}${required?' *':''}</span><textarea name="${name}" placeholder="${esc(optionsOrPlaceholder)}" ${required?'required':''}>${esc(raw || '')}</textarea></label>`;
  return `<label class="field"><span>${label}${required?' *':''}</span><input type="${type}" name="${name}" value="${esc(raw ?? (type==='date'?todayISO():''))}" placeholder="${esc(optionsOrPlaceholder)}" ${type==='number'?'min="0" step="0.01"':''} ${required?'required':''}></label>`;
}
function openEntityForm(collection, id = '') {
  const def = uiMode === 'simple' && simpleFormDefinitions[collection] ? simpleFormDefinitions[collection] : formDefinitions[collection];
  const item = id ? getItem(collection,id) : null;
  const defaultItem = !item && collection === 'agenda' && uiMode === 'simple'
    ? { data: todayISO() }
    : collection === 'medicamentos' && !item ? { ativo:true } : item;
  showModal(`<div class="modal-header"><div><h2 id="modal-title">${item?'Editar':'Novo'} ${def.title.toLowerCase()}</h2><p class="modal-subtitle">Os campos com * são obrigatórios.</p></div><button class="icon-button" data-close aria-label="Fechar">×</button></div>${collection==='medicamentos'?'<div class="notice warning" style="margin-bottom:16px">Transcreva somente uma orientação profissional já recebida. O app não valida nem recomenda doses ou horários.</div>':''}<form id="entity-form" data-collection="${collection}" data-id="${esc(id)}"><div class="form-grid">${def.fields.map(field=>fieldHTML(field,defaultItem)).join('')}</div><div class="modal-actions"><button type="button" class="button secondary" data-close>Cancelar</button><button type="submit" class="button primary">Salvar</button></div></form>`);
}
function submitEntity(form) {
  const collection = form.dataset.collection; const id = form.dataset.id; const existing = id ? getItem(collection,id) : null;
  const values = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input[type="checkbox"]').forEach(input => values[input.name] = input.checked);
  if (collection === 'medicamentos') {
    const parsed = parseMedicationTimes(values.horarios);
    if (parsed.invalid.length) {
      toast(`Use horários no formato 08:00, separados por vírgula. Corrija: ${parsed.invalid.join(', ')}`, true);
      form.elements.horarios?.focus();
      return;
    }
    values.horarios = parsed.times;
    if (!existing && values.ativo === undefined) values.ativo = true;
  }
  if (collection === 'despesas') values.valor = Math.max(0, Number(String(values.valor).replace(',','.')) || 0);
  const item = { ...(existing || {}), ...values, id: existing?.id || uid(), createdAt: existing?.createdAt || nowISO() };
  if (existing) Object.assign(existing,item); else data.collections[collection].push(item);
  if (collection === 'medicamentos') pruneMedicationRecords(data);
  saveData('Registro salvo'); closeModal(); render();
}
function openMedicationRecord(medicationId, time) {
  const med = getItem('medicamentos',medicationId); const existing = data.collections.registrosMedicamentos.find(item=>item.medicamentoId===medicationId&&item.data===selectedDate&&item.horaProgramada===time);
  showModal(`<div class="modal-header"><div><h2 id="modal-title">Registrar administração</h2><p class="modal-subtitle">${esc(med?.nome)} • ${esc(time)} • ${fmtDate(selectedDate)}</p></div><button class="icon-button" data-close>×</button></div><div class="notice warning" style="margin-bottom:17px">Registre o que aconteceu. Não use esta tela para decidir se, quanto ou quando administrar.</div><form id="med-record-form" data-medication="${esc(medicationId)}" data-time="${esc(time)}"><div class="form-grid"><label class="field"><span>Status *</span><select name="status" required><option value="administrado" ${existing?.status==='administrado'?'selected':''}>Administrado conforme orientação</option><option value="nao_realizado" ${existing?.status==='nao_realizado'?'selected':''}>Não realizado</option><option value="adiado" ${existing?.status==='adiado'?'selected':''}>Adiado por orientação recebida</option></select></label><label class="field"><span>Horário registrado</span><input type="time" name="horaRealizada" value="${esc(existing?.horaRealizada || time)}"></label><label class="field full"><span>Responsável pelo registro</span><input name="responsavel" value="${esc(existing?.responsavel || '')}" placeholder="Ex.: Cuidador(a) do turno"></label><label class="field full"><span>Observações administrativas</span><textarea name="observacoes" placeholder="Descreva fatos, sem recomendações próprias">${esc(existing?.observacoes || '')}</textarea></label></div><div class="modal-actions"><button type="button" class="button secondary" data-close>Cancelar</button><button class="button primary">Salvar registro</button></div></form>`);
}
function submitMedicationRecord(form) {
  const medicationId=form.dataset.medication, time=form.dataset.time;
  const values=Object.fromEntries(new FormData(form).entries());
  const existing=data.collections.registrosMedicamentos.find(entry=>entry.medicamentoId===medicationId&&entry.data===selectedDate&&entry.horaProgramada===time);
  const payload={...values,id:existing?.id||uid(),medicamentoId:medicationId,data:selectedDate,horaProgramada:time,createdAt:existing?.createdAt||nowISO()};
  upsertMedicationRecord(data.collections.registrosMedicamentos,payload);
  saveData('Administração registrada'); closeModal(); render();
}
function openEmergencyForm() {
  const e=data.emergency;
  const fields=[['nome','Nome','text'],['comoChamar','Como prefere ser chamado(a)','text'],['dataNascimento','Data de nascimento','date'],['tipoSanguineo','Tipo sanguíneo (somente se confirmado)','text'],['alergias','Alergias informadas','textarea'],['condicoesImportantes','Condições importantes informadas','textarea'],['medicamentosEmUso','Medicamentos em uso (somente conforme informado)','textarea'],['contato1Nome','Contato principal — nome','text'],['contato1Telefone','Contato principal — telefone','tel'],['contato2Nome','Contato alternativo — nome','text'],['contato2Telefone','Contato alternativo — telefone','tel'],['profissionalNome','Profissional/referência — nome','text'],['profissionalTelefone','Profissional/referência — telefone','tel'],['observacoes','Observações','textarea']];
  showModal(`<div class="modal-header"><div><h2 id="modal-title">Editar cartão de emergência</h2><p class="modal-subtitle">Inclua somente informações confirmadas.</p></div><button class="icon-button" data-close>×</button></div><form id="emergency-form"><div class="form-grid">${fields.map(f=>fieldHTML(f,e)).join('')}</div><div class="modal-actions"><button type="button" class="button secondary" data-close>Cancelar</button><button class="button primary">Salvar cartão</button></div></form>`);
}
function showModal(html) { el('modal').innerHTML=th(html); el('modal-backdrop').classList.remove('hidden'); setTimeout(()=>el('modal').querySelector('input,select,textarea,button')?.focus(),0); }
function closeModal() { el('modal-backdrop').classList.add('hidden'); el('modal').innerHTML=''; main.focus({ preventScroll: true }); }

function loadDemo() {
  const blank=createEmptyData(); const day=todayISO();
  blank.settings={onboardingComplete:true,demoLoaded:true};
  blank.profile={nome:'Pessoa de demonstração',comoChamar:'Cuidador(a)',dataNascimento:'',observacoes:'Dados totalmente fictícios'};
  blank.collections.agenda=[{id:uid(),titulo:'Consulta de acompanhamento (exemplo)',data:day,hora:'14:30',tipo:'Consulta',local:'Local fictício',observacoes:'Levar documentos separados.',concluido:false,createdAt:nowISO()}];
  const medId=uid(); blank.collections.medicamentos=[{id:medId,nome:'Medicamento de exemplo',apresentacao:'Apresentação fictícia',orientacao:'Usar somente conforme a orientação profissional cadastrada.',horarios:['08:00','20:00'],profissional:'Profissional de demonstração',observacoes:'Não representa orientação real.',ativo:true,createdAt:nowISO()}];
  blank.collections.diario=[{id:uid(),data:day,hora:'07:45',categoria:'Passagem de plantão',registro:'Rotina da manhã concluída. Registro inteiramente fictício para demonstrar o diário.',responsavel:'Cuidador(a) de exemplo',prioridade:'normal',createdAt:nowISO()}];
  blank.collections.despesas=[{id:uid(),data:day,categoria:'Transporte',descricao:'Deslocamento de exemplo',valor:24.50,formaPagamento:'Outro',observacoes:'Valor fictício.',createdAt:nowISO()}];
  blank.collections.contatos=[{id:uid(),nome:'Contato familiar (exemplo)',relacao:'Familiar fictício',telefone:'(00) 00000-0000',email:'contato@exemplo.invalid',observacoes:'Não é um contato real.',favorito:true,createdAt:nowISO()}];
  blank.emergency={...blank.emergency,nome:'Pessoa de demonstração',comoChamar:'Nome fictício',alergias:'Exemplo — confirme sempre as informações reais',contato1Nome:'Contato fictício',contato1Telefone:'(00) 00000-0000',observacoes:'Este cartão contém apenas dados de demonstração.'};
  return blank;
}
function finishOnboarding(useDemo) {
  data=useDemo?loadDemo():createEmptyData(); data.settings.onboardingComplete=true; saveData(useDemo?'Dados fictícios carregados':'CuidaLocal pronto para uso'); el('onboarding').classList.add('hidden'); render();
}

function handleAction(action) {
  if(action==='simple-home'){route='painel';history.replaceState(null,'','#/painel');render();}
  if(action==='quick-diary') openEntityForm('diario');
  if(action==='alarm-enable') enableAlarms();
  if(action==='alarm-disable') disableAlarms();
  if(action==='alarm-calendar-export') exportAlarmCalendar();
  if(action==='alarm-acknowledge') acknowledgeCurrentAlarms();
  if(action==='print') window.print();
  if(action==='edit-emergency') openEmergencyForm();
  if(action==='backup-export') download(`cuidalocal-backup-${todayISO()}.json`,JSON.stringify(data,null,2),'application/json;charset=utf-8');
  if(action==='backup-import') el('backup-file').click();
  if(action==='csv-export'){const collection=el('csv-collection').value;download(`cuidalocal-${collection}-${todayISO()}.csv`,collectionToCsv(data.collections[collection],CSV_FIELDS[collection]),'text/csv;charset=utf-8');}
  if(action==='clear-data'&&confirm('Tem certeza? Todos os dados do CuidaLocal neste navegador serão apagados permanentemente.')){localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(ALARM_HISTORY_KEY);data=createEmptyData();syncNativeAlarms();el('onboarding').classList.remove('hidden');render();toast('Dados apagados');}
  if(action==='install'&&deferredInstallPrompt){deferredInstallPrompt.prompt();deferredInstallPrompt.userChoice.finally(()=>{deferredInstallPrompt=null;render();});}
}

document.addEventListener('click',event=>{
  const target=event.target.closest('button,[data-action]'); if(!target)return;
  if(target.hasAttribute('data-ui-mode'))return toggleUiMode();
  if(target.matches('[data-close]'))return closeModal();
  if(target.dataset.route){route=target.dataset.route;location.hash=`/${route}`;el('sidebar').classList.remove('open');render();}
  if(target.dataset.routeGo){if(target.closest('#alarm-dialog'))acknowledgeCurrentAlarms();route=target.dataset.routeGo;location.hash=`/${route}`;render();}
  if(target.dataset.action)handleAction(target.dataset.action);
  if(target.dataset.add)openEntityForm(target.dataset.add);
  if(target.dataset.edit){const [collection,id]=target.dataset.edit.split(':');openEntityForm(collection,id);}
  if(target.dataset.delete){const [collection,id]=target.dataset.delete.split(':');removeItem(collection,id);}
  if(target.dataset.toggleAgenda){const item=getItem('agenda',target.dataset.toggleAgenda);item.concluido=!item.concluido;saveData(item.concluido?'Compromisso concluído':'Compromisso reaberto');render();}
  if(target.dataset.register)openMedicationRecord(target.dataset.register,target.dataset.time);
});
document.addEventListener('submit',event=>{
  event.preventDefault();
  if(event.target.id==='entity-form')submitEntity(event.target);
  if(event.target.id==='med-record-form')submitMedicationRecord(event.target);
  if(event.target.id==='emergency-form'){data.emergency={...data.emergency,...Object.fromEntries(new FormData(event.target).entries())};saveData('Cartão atualizado');closeModal();render();}
});
document.addEventListener('input',event=>{
  if(event.target.dataset.filter){const query=event.target.value.toLowerCase();document.querySelectorAll(`#${event.target.dataset.filter}-rows [data-search]`).forEach(row=>row.hidden=!row.dataset.search.includes(query));}
});
document.addEventListener('change',event=>{if(event.target.id==='dashboard-date'){selectedDate=event.target.value||todayISO();render();}});
el('modal-backdrop').addEventListener('click',event=>{if(event.target===el('modal-backdrop'))closeModal();});
el('menu-toggle').addEventListener('click',()=>{const open=el('sidebar').classList.toggle('open');el('menu-toggle').setAttribute('aria-expanded',String(open));});
el('backup-file').addEventListener('change',async event=>{
  const file=event.target.files[0]; if(!file)return;
  try{const parsed=JSON.parse(await file.text());const result=validateBackup(parsed);if(!result.valid)throw new Error(result.errors.join(' '));if(confirm('Restaurar este backup? Os dados atuais serão substituídos.')){data=normalizeImportedData(parsed);data.settings.onboardingComplete=true;saveData('Backup restaurado');render();}}catch(error){toast(`Backup inválido: ${error.message}`,true);}finally{event.target.value='';}
});
window.addEventListener('hashchange',()=>{route=location.hash.replace('#/','')||'painel';render();});
function updateOfflineStatus(message = '', state = 'ready') {
  const node = el('offline-status');
  node.classList.toggle('pending', state === 'pending');
  node.classList.toggle('error', state === 'error');
  if (message) {
    node.textContent = t(message);
    return;
  }
  node.textContent = t(navigator.onLine ? 'Disponível offline' : 'Você está offline');
}
window.addEventListener('online',()=>{updateOfflineStatus(offlineReady ? '' : 'Preparando offline', offlineReady ? 'ready' : 'pending');});
window.addEventListener('offline',()=>{updateOfflineStatus(offlineReady ? '' : 'Você está offline; offline ainda não confirmado', offlineReady ? 'ready' : 'pending');});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;if(route==='painel')render();});
window.addEventListener('keydown',event=>{if(event.key==='Escape')closeModal();});

const ack=el('onboarding-ack');
ack.addEventListener('change',()=>{el('start-empty').disabled=!ack.checked;el('start-demo').disabled=!ack.checked;});
el('start-empty').addEventListener('click',()=>finishOnboarding(false));
el('start-demo').addEventListener('click',()=>finishOnboarding(true));
if(!data.settings.onboardingComplete)el('onboarding').classList.remove('hidden');
if('serviceWorker'in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(()=>navigator.serviceWorker.ready)
    .then(()=>{offlineReady=true;updateOfflineStatus();})
    .catch(()=>{offlineReady=false;updateOfflineStatus('Offline não preparado', 'error');});
} else {
  updateOfflineStatus('Offline não disponível neste navegador', 'error');
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDueAlarms(); });
window.addEventListener('focus', checkDueAlarms);
setInterval(checkDueAlarms, 15000);
const nativeNotifications = localNotificationsPlugin();
if (nativeNotifications) {
  nativeNotifications.addListener?.('localNotificationActionPerformed', event => {
    const destination = event.notification?.extra?.route;
    if (destination && titles[destination]) {
      route = destination;
      location.hash = `/${destination}`;
      render();
    }
  });
  syncNativeAlarms();
}
render();
checkDueAlarms();
