'use client';
import { LogEntry, Prize, Shop } from './types';
import { INITIAL_PRIZES, INITIAL_SHOPS } from './initial-shops';

const KEY = {
  DEVICE_ID: 'ddh_device_id',
  DEVICE_LABEL: 'ddh_device_label',
  LOGS: 'ddh_logs',
  SHOPS: 'ddh_shops',
  PRIZES: 'ddh_prizes',
  GAS_URL: 'ddh_gas_url',
  LOGGED_IN: 'ddh_logged_in',
  USER_ROLE: 'ddh_user_role',
};

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getDeviceId(): string {
  let id = localStorage.getItem(KEY.DEVICE_ID);
  if (!id) {
    id = generateId();
    localStorage.setItem(KEY.DEVICE_ID, id);
  }
  return id;
}

export function getDeviceLabel(): string {
  return localStorage.getItem(KEY.DEVICE_LABEL) || '端末1';
}

export function setDeviceLabel(label: string): void {
  localStorage.setItem(KEY.DEVICE_LABEL, label);
}

export function getLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(KEY.LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addLog(log: LogEntry): void {
  const logs = getLogs();
  logs.unshift(log);
  localStorage.setItem(KEY.LOGS, JSON.stringify(logs));
}

export function markLogsAsSynced(logIds: string[]): void {
  const ids = new Set(logIds);
  const logs = getLogs().map((l) => (ids.has(l.log_id) ? { ...l, synced: true } : l));
  localStorage.setItem(KEY.LOGS, JSON.stringify(logs));
}

export function mergeRemoteLogs(remoteLogs: LogEntry[]): number {
  const logs = getLogs();
  const existingIds = new Set(logs.map((l) => l.log_id));
  const newLogs = remoteLogs.filter((l) => !existingIds.has(l.log_id));
  if (newLogs.length > 0) {
    const merged = [...newLogs, ...logs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    localStorage.setItem(KEY.LOGS, JSON.stringify(merged));
  }
  return newLogs.length;
}

export function getShops(): Shop[] {
  try {
    const raw = localStorage.getItem(KEY.SHOPS);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through
  }
  localStorage.setItem(KEY.SHOPS, JSON.stringify(INITIAL_SHOPS));
  return INITIAL_SHOPS;
}

export function setShops(shops: Shop[]): void {
  localStorage.setItem(KEY.SHOPS, JSON.stringify(shops));
}

export function getPrizes(): Prize[] {
  try {
    const raw = localStorage.getItem(KEY.PRIZES);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through
  }
  localStorage.setItem(KEY.PRIZES, JSON.stringify(INITIAL_PRIZES));
  return INITIAL_PRIZES;
}

export function setPrizes(prizes: Prize[]): void {
  localStorage.setItem(KEY.PRIZES, JSON.stringify(prizes));
}

export function getGasUrl(): string {
  return (
    localStorage.getItem(KEY.GAS_URL) ||
    process.env.NEXT_PUBLIC_GAS_URL ||
    ''
  );
}

export function setGasUrl(url: string): void {
  localStorage.setItem(KEY.GAS_URL, url);
}

export function isLoggedIn(): boolean {
  return localStorage.getItem(KEY.LOGGED_IN) === '1';
}

export function setLoggedIn(): void {
  localStorage.setItem(KEY.LOGGED_IN, '1');
}

export function setUserRole(id: string): void {
  localStorage.setItem(KEY.USER_ROLE, id);
}

export function getUserRole(): string {
  return localStorage.getItem(KEY.USER_ROLE) || '';
}

export function isAdmin(): boolean {
  return localStorage.getItem(KEY.USER_ROLE) === 'kanrisha';
}

export function clearSession(): void {
  localStorage.removeItem(KEY.LOGGED_IN);
  localStorage.removeItem(KEY.USER_ROLE);
}
