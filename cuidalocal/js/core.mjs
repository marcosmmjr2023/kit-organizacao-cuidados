const SCHEMA_VERSION = 2;

const COLLECTION_FIELDS = {
  agenda: ['id', 'titulo', 'data', 'hora', 'tipo', 'local', 'observacoes', 'concluido', 'createdAt'],
  medicamentos: ['id', 'nome', 'apresentacao', 'orientacao', 'horarios', 'profissional', 'observacoes', 'ativo', 'createdAt'],
  registrosMedicamentos: ['id', 'medicamentoId', 'data', 'horaProgramada', 'horaRealizada', 'status', 'responsavel', 'observacoes', 'createdAt'],
  diario: ['id', 'data', 'hora', 'categoria', 'registro', 'responsavel', 'prioridade', 'createdAt'],
  despesas: ['id', 'data', 'categoria', 'descricao', 'valor', 'formaPagamento', 'observacoes', 'createdAt'],
  contatos: ['id', 'nome', 'relacao', 'telefone', 'email', 'observacoes', 'favorito', 'createdAt'],
};

const PROFILE_FIELDS = ['nome', 'comoChamar', 'dataNascimento', 'observacoes'];
const EMERGENCY_FIELDS = ['nome', 'comoChamar', 'dataNascimento', 'tipoSanguineo', 'alergias', 'condicoesImportantes', 'medicamentosEmUso', 'contato1Nome', 'contato1Telefone', 'contato2Nome', 'contato2Telefone', 'profissionalNome', 'profissionalTelefone', 'observacoes'];

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function createEmptyData() {
  return {
    meta: { app: 'CuidaLocal', schemaVersion: SCHEMA_VERSION, updatedAt: '' },
    settings: { onboardingComplete: false, demoLoaded: false },
    profile: { nome: '', comoChamar: '', dataNascimento: '', observacoes: '' },
    emergency: Object.fromEntries(EMERGENCY_FIELDS.map(field => [field, ''])),
    collections: Object.fromEntries(Object.keys(COLLECTION_FIELDS).map(key => [key, []])),
  };
}

export function validateBackup(value) {
  const errors = [];
  if (!isPlainObject(value)) return { valid: false, errors: ['O arquivo não contém um objeto JSON válido.'] };
  if (!isPlainObject(value.meta) || value.meta.schemaVersion !== SCHEMA_VERSION) errors.push('Versão de backup incompatível; é necessária a versão 2.');
  if (!isPlainObject(value.collections)) errors.push('As coleções do backup estão ausentes ou inválidas.');
  else {
    for (const key of Object.keys(COLLECTION_FIELDS)) {
      if (!Array.isArray(value.collections[key])) errors.push(`A coleção “${key}” está ausente ou inválida.`);
    }
  }
  if (value.profile !== undefined && !isPlainObject(value.profile)) errors.push('O perfil está inválido.');
  if (value.emergency !== undefined && !isPlainObject(value.emergency)) errors.push('O cartão de emergência está inválido.');
  return { valid: errors.length === 0, errors };
}

function pick(source, fields, defaults = {}) {
  const safe = isPlainObject(source) ? source : {};
  return Object.fromEntries(fields.map(field => [field, safe[field] ?? defaults[field] ?? '']));
}

function normalizeItem(collection, item) {
  const result = pick(item, COLLECTION_FIELDS[collection]);
  if (collection === 'medicamentos') result.horarios = Array.isArray(result.horarios) ? result.horarios.filter(time => typeof time === 'string').slice(0, 12) : [];
  if (['agenda'].includes(collection)) result.concluido = Boolean(result.concluido);
  if (collection === 'medicamentos') result.ativo = result.ativo !== false;
  if (collection === 'contatos') result.favorito = Boolean(result.favorito);
  if (collection === 'despesas') result.valor = Number.isFinite(Number(result.valor)) ? Math.max(0, Number(result.valor)) : 0;
  return result;
}

export function normalizeImportedData(value) {
  const base = createEmptyData();
  const safe = isPlainObject(value) ? value : {};
  base.settings.onboardingComplete = Boolean(safe.settings?.onboardingComplete);
  base.settings.demoLoaded = Boolean(safe.settings?.demoLoaded);
  base.profile = pick(safe.profile, PROFILE_FIELDS);
  base.emergency = pick(safe.emergency, EMERGENCY_FIELDS);
  for (const key of Object.keys(COLLECTION_FIELDS)) {
    base.collections[key] = (Array.isArray(safe.collections?.[key]) ? safe.collections[key] : [])
      .filter(isPlainObject)
      .slice(0, 10000)
      .map(item => normalizeItem(key, item));
  }
  base.meta.updatedAt = typeof safe.meta?.updatedAt === 'string' ? safe.meta.updatedAt : '';
  return base;
}

export function buildDailyOverview(data, date) {
  const collections = data?.collections || {};
  const agenda = (collections.agenda || [])
    .filter(item => item.data === date)
    .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));
  const records = collections.registrosMedicamentos || [];
  const medicamentos = (collections.medicamentos || [])
    .filter(item => item.ativo !== false)
    .flatMap(item => (Array.isArray(item.horarios) ? item.horarios : []).map(hora => {
      const record = records.find(entry => entry.medicamentoId === item.id && entry.data === date && entry.horaProgramada === hora);
      return {
        medicamentoId: item.id,
        nome: item.nome,
        apresentacao: item.apresentacao || '',
        orientacao: item.orientacao || '',
        hora,
        status: record?.status || 'pendente',
        registroId: record?.id || '',
      };
    }))
    .sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
  return { agenda, medicamentos };
}

export function upsertMedicationRecord(records, payload) {
  const existing = records.find(entry => entry.medicamentoId === payload.medicamentoId && entry.data === payload.data && entry.horaProgramada === payload.horaProgramada);
  if (existing) {
    const originalId = existing.id;
    Object.assign(existing, payload, { id: originalId });
    return existing;
  }
  records.push(payload);
  return payload;
}

export function calculateExpenseSummary(expenses, month) {
  const centsByCategory = {};
  for (const item of Array.isArray(expenses) ? expenses : []) {
    if (!String(item.data || '').startsWith(month)) continue;
    const cents = Math.round((Number(item.valor) || 0) * 100);
    const category = String(item.categoria || 'Outros');
    centsByCategory[category] = (centsByCategory[category] || 0) + cents;
  }
  const porCategoria = Object.fromEntries(Object.entries(centsByCategory).map(([key, cents]) => [key, cents / 100]));
  const total = Object.values(centsByCategory).reduce((sum, cents) => sum + cents, 0) / 100;
  return { total, porCategoria };
}

function csvCell(value) {
  let text = value === null || value === undefined ? '' : Array.isArray(value) ? value.join(' | ') : String(value);
  const dangerous = /^[=+\-@]/.test(text.trimStart());
  if (dangerous) text = `'${text}`;
  if (dangerous || /[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function collectionToCsv(items, fields) {
  const rows = [fields.map(csvCell).join(',')];
  for (const item of Array.isArray(items) ? items : []) rows.push(fields.map(field => csvCell(item?.[field])).join(','));
  return `\ufeff${rows.join('\r\n')}`;
}

export const CSV_FIELDS = COLLECTION_FIELDS;
