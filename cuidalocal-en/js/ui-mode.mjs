export const UI_MODE_KEY = 'cuidalocal:v2:ui-mode';
export const SIMPLE_ROUTES = Object.freeze(['painel', 'agenda', 'medicamentos', 'contatos', 'emergencia']);

export function readUiMode(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    return target?.getItem(UI_MODE_KEY) === 'simple' ? 'simple' : 'full';
  } catch {
    return 'full';
  }
}

export function writeUiMode(storage, mode = 'full') {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    target?.setItem(UI_MODE_KEY, mode === 'simple' ? 'simple' : 'full');
    return true;
  } catch {
    return false;
  }
}

export function isSimpleRoute(route) {
  return SIMPLE_ROUTES.includes(route);
}

export function phoneHref(phone) {
  const text = String(phone || '').trim();
  const prefix = text.startsWith('+') ? '+' : '';
  const digits = text.replace(/\D/g, '');
  return digits.length >= 8 ? `tel:${prefix}${digits}` : '';
}
