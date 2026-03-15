'use client';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { LogEntry, Prize, Shop } from '@/lib/types';
import * as storage from '@/lib/storage';
import * as gas from '@/lib/gas';

interface AppContextValue {
  // State
  deviceId: string;
  deviceLabel: string;
  gasUrl: string;
  shops: Shop[];
  prizes: Prize[];
  logs: LogEntry[];
  isSyncing: boolean;
  lastSyncedAt: string | null;

  // Actions
  setDeviceLabel: (label: string) => void;
  setGasUrl: (url: string) => void;
  addLog: (data: Omit<LogEntry, 'log_id' | 'device_id' | 'device_label' | 'synced' | 'from_remote'>) => void;
  syncLogs: () => Promise<{ sent: number; error?: string }>;
  fetchRemoteLogs: (date: string) => Promise<{ received: number; error?: string }>;
  fetchRemoteSettings: () => Promise<{ ok: boolean; error?: string }>;
  updateShop: (shop: Shop) => void;
  deleteShop: (storeId: string) => void;
  setShops: (shops: Shop[]) => void;
  setPrizes: (prizes: Prize[]) => void;
  logout: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [deviceId, setDeviceId] = useState('');
  const [deviceLabel, setDeviceLabelState] = useState('');
  const [gasUrl, setGasUrlState] = useState('');
  const [shops, setShopsState] = useState<Shop[]>([]);
  const [prizes, setPrizesState] = useState<Prize[]>([]);
  const [logs, setLogsState] = useState<LogEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    setDeviceId(storage.getDeviceId());
    setDeviceLabelState(storage.getDeviceLabel());
    setGasUrlState(storage.getGasUrl());
    setShopsState(storage.getShops());
    setPrizesState(storage.getPrizes());
    setLogsState(storage.getLogs());
  }, []);

  const setDeviceLabel = useCallback((label: string) => {
    storage.setDeviceLabel(label);
    setDeviceLabelState(label);
  }, []);

  const setGasUrl = useCallback((url: string) => {
    storage.setGasUrl(url);
    setGasUrlState(url);
  }, []);

  const addLog = useCallback(
    (data: Omit<LogEntry, 'log_id' | 'device_id' | 'device_label' | 'synced' | 'from_remote'>) => {
      const log: LogEntry = {
        ...data,
        log_id: crypto.randomUUID(),
        device_id: storage.getDeviceId(),
        device_label: storage.getDeviceLabel(),
        synced: false,
        from_remote: false,
      };
      storage.addLog(log);
      setLogsState(storage.getLogs());
    },
    []
  );

  const syncLogs = useCallback(async () => {
    if (!gasUrl) return { sent: 0, error: 'GAS URLが設定されていません' };
    const unsynced = logs.filter((l) => !l.synced && !l.from_remote);
    if (unsynced.length === 0) return { sent: 0 };
    setIsSyncing(true);
    try {
      const ok = await gas.sendLogs(gasUrl, unsynced);
      if (ok) {
        storage.markLogsAsSynced(unsynced.map((l) => l.log_id));
        setLogsState(storage.getLogs());
        setLastSyncedAt(new Date().toISOString());
        return { sent: unsynced.length };
      }
      return { sent: 0, error: '送信に失敗しました' };
    } finally {
      setIsSyncing(false);
    }
  }, [gasUrl, logs]);

  const fetchRemoteLogs = useCallback(
    async (date: string) => {
      if (!gasUrl) return { received: 0, error: 'GAS URLが設定されていません' };
      setIsSyncing(true);
      try {
        const remoteLogs = await gas.fetchLogs(gasUrl, date);
        const count = storage.mergeRemoteLogs(remoteLogs);
        setLogsState(storage.getLogs());
        return { received: count };
      } catch (e) {
        return { received: 0, error: String(e) };
      } finally {
        setIsSyncing(false);
      }
    },
    [gasUrl]
  );

  const fetchRemoteSettings = useCallback(async () => {
    if (!gasUrl) return { ok: false, error: 'GAS URLが設定されていません' };
    setIsSyncing(true);
    try {
      const settings = await gas.fetchSettings(gasUrl);
      if (settings) {
        if (settings.shops.length > 0) {
          storage.setShops(settings.shops);
          setShopsState(settings.shops);
        }
        if (settings.prizes.length > 0) {
          const sorted = [...settings.prizes].sort((a, b) => a.order - b.order);
          storage.setPrizes(sorted);
          setPrizesState(sorted);
        }
        return { ok: true };
      }
      return { ok: false, error: '設定の取得に失敗しました' };
    } finally {
      setIsSyncing(false);
    }
  }, [gasUrl]);

  const updateShop = useCallback(
    (shop: Shop) => {
      const updated = shops.some((s) => s.store_id === shop.store_id)
        ? shops.map((s) => (s.store_id === shop.store_id ? shop : s))
        : [...shops, shop];
      storage.setShops(updated);
      setShopsState(updated);
      if (gasUrl) gas.updateStore(gasUrl, shop).catch(() => {});
    },
    [shops, gasUrl]
  );

  const deleteShop = useCallback(
    (storeId: string) => {
      const updated = shops.filter((s) => s.store_id !== storeId);
      storage.setShops(updated);
      setShopsState(updated);
      if (gasUrl) gas.deleteStore(gasUrl, storeId).catch(() => {});
    },
    [shops, gasUrl]
  );

  const setShops = useCallback((s: Shop[]) => {
    storage.setShops(s);
    setShopsState(s);
  }, []);

  const setPrizes = useCallback((p: Prize[]) => {
    storage.setPrizes(p);
    setPrizesState(p);
    if (gasUrl) gas.updatePrizes(gasUrl, p).catch(() => {});
  }, [gasUrl]);

  const logout = useCallback(() => {
    storage.clearSession();
    window.location.href = '/login';
  }, []);

  return (
    <AppContext.Provider
      value={{
        deviceId, deviceLabel, gasUrl, shops, prizes, logs,
        isSyncing, lastSyncedAt,
        setDeviceLabel, setGasUrl, addLog, syncLogs, fetchRemoteLogs,
        fetchRemoteSettings, updateShop, deleteShop, setShops, setPrizes, logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
