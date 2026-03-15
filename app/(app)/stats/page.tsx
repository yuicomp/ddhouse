'use client';
import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import type { LogEntry } from '@/lib/types';
import { RefreshCw, Send } from 'lucide-react';

type SubTab = 'logs' | 'hourly' | 'stores' | 'prizes';

function toTimeJST(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
}
function getHourJST(isoStr: string) {
  return new Date(isoStr).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit' }).replace('時', '');
}
function todayJST() {
  return new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
}

function SyncBadge({ log }: { log: LogEntry }) {
  if (log.from_remote) return <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">📥他端末</span>;
  if (log.synced) return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">✅済</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">🟡未送信</span>;
}

export default function StatsPage() {
  const { logs, prizes, syncLogs, fetchRemoteLogs, isSyncing, gasUrl } = useApp();

  const today = todayJST();
  const [selectedDate, setSelectedDate] = useState(today);
  const [subTab, setSubTab] = useState<SubTab>('logs');
  const [message, setMessage] = useState('');

  // Filter logs for selected date
  const filteredLogs = useMemo(
    () => logs.filter((l) => l.timestamp.startsWith(selectedDate)),
    [logs, selectedDate]
  );

  const unsyncedCount = useMemo(
    () => logs.filter((l) => !l.synced && !l.from_remote).length,
    [logs]
  );

  async function handleSend() {
    if (!gasUrl) { setMessage('GAS URLが設定されていません'); return; }
    setMessage('');
    const { sent, error } = await syncLogs();
    setMessage(error ? `エラー: ${error}` : `${sent}件を送信しました`);
    setTimeout(() => setMessage(''), 3000);
  }

  async function handleRefresh() {
    if (!gasUrl) { setMessage('GAS URLが設定されていません'); return; }
    setMessage('');
    const { received, error } = await fetchRemoteLogs(selectedDate);
    setMessage(error ? `エラー: ${error}` : `${received}件を受信しました`);
    setTimeout(() => setMessage(''), 3000);
  }

  // Hourly stats
  const hourlyData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredLogs.forEach((l) => {
      const h = getHourJST(l.timestamp);
      map[h] = (map[h] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredLogs]);

  // Store stats
  const storeData = useMemo(() => {
    const map: Record<string, { name: string; floor: string; count: number; slots: number }> = {};
    filteredLogs.forEach((l) => {
      if (!map[l.store_id]) map[l.store_id] = { name: l.store_name, floor: l.floor, count: 0, slots: 0 };
      map[l.store_id].count++;
      map[l.store_id].slots += l.slot_count;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [filteredLogs]);

  // Prize stats
  const prizeData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredLogs.forEach((l) => {
      Object.entries(l.prizes).forEach(([id, cnt]) => {
        map[id] = (map[id] || 0) + cnt;
      });
    });
    const totalSlots = filteredLogs.reduce((a, b) => a + b.slot_count, 0);
    const totalWins = Object.values(map).reduce((a, b) => a + b, 0);
    return { map, totalSlots, totalWins, miss: totalSlots - totalWins };
  }, [filteredLogs]);

  const maxHourly = Math.max(...hourlyData.map(([, c]) => c), 1);

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="bg-white px-4 pt-3 pb-2 shadow-sm space-y-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-base focus:outline-none focus:border-brand-500"
          />
          <button
            onClick={handleRefresh}
            disabled={isSyncing}
            className="flex items-center gap-1 px-3 py-2 bg-brand-50 text-brand-700 rounded-xl text-sm font-medium active:bg-brand-100 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            更新
          </button>
          {unsyncedCount > 0 && (
            <button
              onClick={handleSend}
              disabled={isSyncing}
              className="flex items-center gap-1 px-3 py-2 bg-yellow-500 text-white rounded-xl text-sm font-medium active:bg-yellow-600 disabled:opacity-50"
            >
              <Send size={16} />
              未送信{unsyncedCount}件
            </button>
          )}
        </div>
        {message && (
          <div className="text-sm text-brand-600 font-medium">{message}</div>
        )}

        {/* Sub-tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([['logs', '全ログ'], ['hourly', '時間別'], ['stores', '店舗別'], ['prizes', '賞集計']] as [SubTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                subTab === key ? 'bg-white text-brand-700 shadow' : 'text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-brand-50 px-4 py-2 flex gap-4 text-sm flex-shrink-0">
        <span className="text-gray-600">登録 <b className="text-brand-700">{filteredLogs.length}件</b></span>
        <span className="text-gray-600">スロット <b className="text-brand-700">{filteredLogs.reduce((a, b) => a + b.slot_count, 0)}回</b></span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* 全ログ */}
        {subTab === 'logs' && (
          <div className="space-y-2">
            {filteredLogs.length === 0 && (
              <p className="text-center text-gray-400 py-10">この日のログはありません</p>
            )}
            {filteredLogs.map((log) => (
              <div key={log.log_id} className="bg-white rounded-xl p-3 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-gray-800 text-sm">{log.store_name}</div>
                    <div className="text-xs text-gray-400">{log.floor} · {toTimeJST(log.timestamp)} · {log.device_label}</div>
                  </div>
                  <SyncBadge log={log} />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {log.receipt_amount.toLocaleString()}円 → {log.slot_count}回
                  </span>
                  {prizes.sort((a, b) => a.order - b.order).map((p) => {
                    const cnt = log.prizes[p.prize_id] || 0;
                    if (cnt === 0) return null;
                    return (
                      <span key={p.prize_id} className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-bold">
                        {p.name} ×{cnt}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 時間別 */}
        {subTab === 'hourly' && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
            <h3 className="font-bold text-gray-700 mb-3">1時間ごとの登録件数</h3>
            {hourlyData.length === 0 && <p className="text-center text-gray-400 py-6">データなし</p>}
            {hourlyData.map(([hour, count]) => (
              <div key={hour} className="flex items-center gap-3">
                <span className="w-14 text-sm text-gray-500 tabular-nums text-right">{hour}:00〜</span>
                <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                  <div
                    className="bg-brand-500 h-full rounded-full flex items-center px-2 transition-all"
                    style={{ width: `${(count / maxHourly) * 100}%`, minWidth: '2rem' }}
                  >
                    <span className="text-white text-xs font-bold">{count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 店舗別 */}
        {subTab === 'stores' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <h3 className="font-bold text-gray-700 p-4 pb-2">店舗ごとの来客数</h3>
            {storeData.length === 0 && <p className="text-center text-gray-400 py-6">データなし</p>}
            {storeData.map((s, i) => (
              <div key={i} className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-800">{s.name}</div>
                  <div className="text-xs text-gray-400">{s.floor}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-brand-600">{s.count}件</div>
                  <div className="text-xs text-gray-400">計{s.slots}回</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 賞集計 */}
        {subTab === 'prizes' && (
          <div className="space-y-3">
            {/* 割合バーチャート */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h3 className="font-bold text-gray-700 mb-4">賞ごとの割合</h3>
              {prizeData.totalSlots === 0 ? (
                <p className="text-center text-gray-400 py-4">データなし</p>
              ) : (
                <div className="space-y-4">
                  {prizes.sort((a, b) => a.order - b.order).map((p) => {
                    const cnt = prizeData.map[p.prize_id] || 0;
                    const pct = prizeData.totalSlots > 0 ? (cnt / prizeData.totalSlots) * 100 : 0;
                    return (
                      <div key={p.prize_id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-gray-700">{p.name}</span>
                          <span className="text-sm font-bold text-brand-600 tabular-nums">
                            {cnt}回 <span className="text-gray-400 font-normal">({pct.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-6 overflow-hidden">
                          <div
                            className="bg-brand-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {/* ハズレ */}
                  {(() => {
                    const cnt = Math.max(0, prizeData.miss);
                    const pct = prizeData.totalSlots > 0 ? (cnt / prizeData.totalSlots) * 100 : 0;
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-gray-400">ハズレ</span>
                          <span className="text-sm font-bold text-gray-400 tabular-nums">
                            {cnt}回 <span className="font-normal">({pct.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-6 overflow-hidden">
                          <div
                            className="bg-gray-300 h-full rounded-full transition-all"
                            style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* 総合計 */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
              <h3 className="font-bold text-gray-700 mb-2">総合計</h3>
              <div className="flex justify-between">
                <span className="text-gray-500">スロット総数</span>
                <span className="font-bold tabular-nums">{prizeData.totalSlots}回</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">当選総数</span>
                <span className="font-bold text-brand-600 tabular-nums">{prizeData.totalWins}回</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
