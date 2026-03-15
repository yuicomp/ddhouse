import { LogEntry, Prize, Shop } from './types';

async function call(method: 'GET' | 'POST', gasUrl: string, params: Record<string, unknown>) {
  const url = method === 'GET'
    ? `/api/gas?gasUrl=${encodeURIComponent(gasUrl)}&${new URLSearchParams(params as Record<string, string>).toString()}`
    : '/api/gas';

  const opts: RequestInit =
    method === 'GET'
      ? { method: 'GET' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gasUrl, ...params }),
        };

  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function authenticate(gasUrl: string, id: string, pass: string): Promise<boolean> {
  try {
    const data = await call('GET', gasUrl, { action: 'auth', id, pass });
    return data.success === true;
  } catch {
    return false;
  }
}

export async function fetchSettings(
  gasUrl: string
): Promise<{ shops: Shop[]; prizes: Prize[] } | null> {
  try {
    const data = await call('GET', gasUrl, { action: 'getSettings' });
    if (data.success) return { shops: data.shops, prizes: data.prizes };
    return null;
  } catch {
    return null;
  }
}

export async function fetchLogs(gasUrl: string, date: string): Promise<LogEntry[]> {
  try {
    const data = await call('GET', gasUrl, { action: 'getLogs', date });
    return data.success ? data.logs : [];
  } catch {
    return [];
  }
}

export async function sendLogs(gasUrl: string, logs: LogEntry[]): Promise<boolean> {
  try {
    const data = await call('POST', gasUrl, { action: 'appendLogs', logs });
    return data.success === true;
  } catch {
    return false;
  }
}

export async function updateStore(gasUrl: string, shop: Shop): Promise<boolean> {
  try {
    const data = await call('POST', gasUrl, { action: 'updateStore', store: shop });
    return data.success === true;
  } catch {
    return false;
  }
}

export async function deleteStore(gasUrl: string, storeId: string): Promise<boolean> {
  try {
    const data = await call('POST', gasUrl, { action: 'deleteStore', store_id: storeId });
    return data.success === true;
  } catch {
    return false;
  }
}

export async function updatePrizes(gasUrl: string, prizes: Prize[]): Promise<boolean> {
  try {
    const data = await call('POST', gasUrl, { action: 'updatePrizes', prizes });
    return data.success === true;
  } catch {
    return false;
  }
}

export async function deleteLogs(
  gasUrl: string,
  logIds: string[]
): Promise<{ deleted: number; error?: string }> {
  try {
    const data = await call('POST', gasUrl, { action: 'deleteLogs', log_ids: logIds });
    if (data.success) return { deleted: data.deleted ?? 0 };
    return { deleted: 0, error: data.error };
  } catch (e) {
    return { deleted: 0, error: String(e) };
  }
}
