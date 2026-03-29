'use client';
import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import type { LogEntry } from '@/lib/types';
import { RefreshCw, Send } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

type SubTab = 'logs' | 'hourly' | 'stores' | 'prizes' | 'qr';
type HourlyBreakdown = 'none' | 'store' | 'floor';
type StoreBreakdown  = 'none' | 'hour'  | 'floor';
type PrizeBreakdown  = 'none' | 'store' | 'floor';

const FLOORS = ['B1F', '1F', '2F', '3F'];
const REGISTER_URL = 'https://ddhouse-flax.vercel.app/register';

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
  if (log.synced)      return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">✅済</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">🟡未送信</span>;
}

// ─── クロス集計テーブル（時間別・店舗別共通）───────────────────────────────
type CrossTabData = {
  rows: string[];
  cols: string[];
  cells: Record<string, Record<string, { count: number; slots: number }>>;
};

function CrossTabTable({
  data, mode, rowLabel, formatRow,
}: {
  data: CrossTabData;
  mode: 'count' | 'slots';
  rowLabel: string;
  formatRow?: (r: string) => string;
}) {
  const { rows, cols, cells } = data;
  const get = (row: string, col: string) => {
    const c = cells[row]?.[col];
    return c ? (mode === 'count' ? c.count : c.slots) : 0;
  };
  const rowTotals = rows.map(row => cols.reduce((s, col) => s + get(row, col), 0));
  const colTotals = cols.map(col => rows.reduce((s, row) => s + get(row, col), 0));
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

  if (rows.length === 0) return <p className="text-center text-gray-400 py-6">データなし</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap border-b border-r border-gray-100">
              {rowLabel}
            </th>
            {cols.map(col => (
              <th key={col} className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap min-w-14 border-b border-gray-100">
                {col}
              </th>
            ))}
            <th className="px-2 py-2 text-center text-brand-600 font-bold whitespace-nowrap border-b border-l border-gray-100">
              合計
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
              <td className="sticky left-0 z-10 bg-inherit px-3 py-2 text-gray-700 font-medium whitespace-nowrap border-r border-gray-100">
                {formatRow ? formatRow(row) : row}
              </td>
              {cols.map(col => {
                const v = get(row, col);
                return (
                  <td key={col} className={`px-2 py-2 text-center tabular-nums ${v > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                    {v > 0 ? v : '—'}
                  </td>
                );
              })}
              <td className="px-2 py-2 text-center font-bold text-brand-600 tabular-nums border-l border-gray-100">
                {rowTotals[i]}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-brand-50 border-t-2 border-brand-100">
            <td className="sticky left-0 z-10 bg-brand-50 px-3 py-2 text-brand-700 font-bold border-r border-brand-100">
              合計
            </td>
            {cols.map((col, j) => (
              <td key={col} className="px-2 py-2 text-center font-bold text-brand-600 tabular-nums">
                {colTotals[j]}
              </td>
            ))}
            <td className="px-2 py-2 text-center font-bold text-brand-700 tabular-nums border-l border-brand-100">
              {grandTotal}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── 賞クロス集計テーブル ────────────────────────────────────────────────────
function PrizeCrossTabTable({
  prizeRows, cols, cells,
}: {
  prizeRows: { id: string; name: string; isMiss?: boolean }[];
  cols: string[];
  cells: Record<string, Record<string, number>>;
}) {
  const get = (id: string, col: string) => cells[id]?.[col] || 0;
  const rowTotals = prizeRows.map(p => cols.reduce((s, col) => s + get(p.id, col), 0));
  const colTotals = cols.map(col => prizeRows.reduce((s, p) => s + get(p.id, col), 0));
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

  if (prizeRows.length === 0 || cols.length === 0) {
    return <p className="text-center text-gray-400 py-6">データなし</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap border-b border-r border-gray-100">
              賞
            </th>
            {cols.map(col => (
              <th key={col} className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap min-w-14 border-b border-gray-100">
                {col}
              </th>
            ))}
            <th className="px-2 py-2 text-center text-brand-600 font-bold whitespace-nowrap border-b border-l border-gray-100">
              合計
            </th>
          </tr>
        </thead>
        <tbody>
          {prizeRows.map((p, i) => (
            <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
              <td className={`sticky left-0 z-10 bg-inherit px-3 py-2 font-medium whitespace-nowrap border-r border-gray-100 ${p.isMiss ? 'text-gray-400' : 'text-gray-700'}`}>
                {p.name}
              </td>
              {cols.map(col => {
                const v = get(p.id, col);
                return (
                  <td key={col} className={`px-2 py-2 text-center tabular-nums ${v > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                    {v > 0 ? v : '—'}
                  </td>
                );
              })}
              <td className="px-2 py-2 text-center font-bold text-brand-600 tabular-nums border-l border-gray-100">
                {rowTotals[i]}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-brand-50 border-t-2 border-brand-100">
            <td className="sticky left-0 z-10 bg-brand-50 px-3 py-2 text-brand-700 font-bold border-r border-brand-100">
              合計
            </td>
            {cols.map((col, j) => (
              <td key={col} className="px-2 py-2 text-center font-bold text-brand-600 tabular-nums">
                {colTotals[j]}
              </td>
            ))}
            <td className="px-2 py-2 text-center font-bold text-brand-700 tabular-nums border-l border-brand-100">
              {grandTotal}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── 内訳セレクター ──────────────────────────────────────────────────────────
function BreakdownSelector<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-xs text-gray-400 shrink-0">内訳:</span>
      <div className="flex gap-1 bg-gray-100 rounded-xl p-0.5 flex-1">
        {options.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition ${
              value === key ? 'bg-white text-brand-700 shadow' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function StatsPage() {
  const { logs, prizes, syncLogs, fetchRemoteLogs, isSyncing, gasUrl } = useApp();

  const today = todayJST();
  const [selectedDate, setSelectedDate] = useState(today);
  const [subTab, setSubTab] = useState<SubTab>('logs');
  const [message, setMessage] = useState('');
  const [hourlyMode, setHourlyMode] = useState<'count' | 'slots'>('count');
  const [storeMode,  setStoreMode]  = useState<'count' | 'slots'>('count');

  const [hourlyBreakdown, setHourlyBreakdown] = useState<HourlyBreakdown>('none');
  const [storeBreakdown,  setStoreBreakdown]  = useState<StoreBreakdown>('none');
  const [prizeBreakdown,  setPrizeBreakdown]  = useState<PrizeBreakdown>('none');

  // ── フィルタ ──────────────────────────────────────────────────────────────
  const filteredLogs = useMemo(
    () => logs.filter((l) => l.timestamp.startsWith(selectedDate)),
    [logs, selectedDate]
  );

  const unsyncedCount = useMemo(
    () => logs.filter((l) => !l.synced && !l.from_remote).length,
    [logs]
  );

  // ── 同期ハンドラ ──────────────────────────────────────────────────────────
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

  // ── 時間別集計（通常） ────────────────────────────────────────────────────
  const hourlyData = useMemo(() => {
    const map: Record<string, { count: number; slots: number }> = {};
    filteredLogs.forEach((l) => {
      const h = getHourJST(l.timestamp);
      if (!map[h]) map[h] = { count: 0, slots: 0 };
      map[h].count++;
      map[h].slots += l.slot_count;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredLogs]);

  // ── 店舗別集計（通常） ────────────────────────────────────────────────────
  const storeData = useMemo(() => {
    const map: Record<string, { name: string; floor: string; count: number; slots: number }> = {};
    filteredLogs.forEach((l) => {
      if (!map[l.store_id]) map[l.store_id] = { name: l.store_name, floor: l.floor, count: 0, slots: 0 };
      map[l.store_id].count++;
      map[l.store_id].slots += l.slot_count;
    });
    return Object.values(map).sort((a, b) =>
      storeMode === 'count' ? b.count - a.count : b.slots - a.slots
    );
  }, [filteredLogs, storeMode]);

  // ── 賞集計（通常） ───────────────────────────────────────────────────────
  const prizeData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredLogs.forEach((l) => {
      Object.entries(l.prizes).forEach(([id, cnt]) => {
        map[id] = (map[id] || 0) + cnt;
      });
    });
    const totalSlots = filteredLogs.reduce((a, b) => a + b.slot_count, 0);
    const totalWins  = Object.values(map).reduce((a, b) => a + b, 0);
    return { map, totalSlots, totalWins, miss: totalSlots - totalWins };
  }, [filteredLogs]);

  // ── 時間別クロス集計（店舗 or フロア） ────────────────────────────────────
  const hourlyCrossTab = useMemo((): CrossTabData | null => {
    if (hourlyBreakdown === 'none') return null;
    const cells: CrossTabData['cells'] = {};
    const colSet = new Set<string>();
    filteredLogs.forEach((l) => {
      const row = getHourJST(l.timestamp);
      const col = hourlyBreakdown === 'store' ? l.store_name : l.floor;
      colSet.add(col);
      if (!cells[row]) cells[row] = {};
      if (!cells[row][col]) cells[row][col] = { count: 0, slots: 0 };
      cells[row][col].count++;
      cells[row][col].slots += l.slot_count;
    });
    const rows = Object.keys(cells).sort();
    const cols = hourlyBreakdown === 'floor'
      ? FLOORS.filter(f => colSet.has(f))
      : Array.from(colSet).sort();
    return { rows, cols, cells };
  }, [filteredLogs, hourlyBreakdown]);

  // ── 店舗別クロス集計（時間別） ────────────────────────────────────────────
  const storeCrossTab = useMemo((): CrossTabData | null => {
    if (storeBreakdown !== 'hour') return null;
    const cells: CrossTabData['cells'] = {};
    const colSet = new Set<string>();
    filteredLogs.forEach((l) => {
      const row = l.store_name;
      const col = `${getHourJST(l.timestamp)}:00〜`;
      colSet.add(col);
      if (!cells[row]) cells[row] = {};
      if (!cells[row][col]) cells[row][col] = { count: 0, slots: 0 };
      cells[row][col].count++;
      cells[row][col].slots += l.slot_count;
    });
    const cols = Array.from(colSet).sort();
    const rows = Object.keys(cells).sort((a, b) => {
      const tA = cols.reduce((s, c) => s + (storeMode === 'count' ? (cells[a][c]?.count || 0) : (cells[a][c]?.slots || 0)), 0);
      const tB = cols.reduce((s, c) => s + (storeMode === 'count' ? (cells[b][c]?.count || 0) : (cells[b][c]?.slots || 0)), 0);
      return tB - tA;
    });
    return { rows, cols, cells };
  }, [filteredLogs, storeBreakdown, storeMode]);

  // ── 店舗別フロアグループ ──────────────────────────────────────────────────
  const storeByFloor = useMemo(() => {
    if (storeBreakdown !== 'floor') return null;
    const grouped: Record<string, typeof storeData> = {};
    storeData.forEach(s => {
      if (!grouped[s.floor]) grouped[s.floor] = [];
      grouped[s.floor].push(s);
    });
    return FLOORS.filter(f => grouped[f]?.length > 0).map(f => ({
      floor: f,
      stores: grouped[f],
    }));
  }, [storeData, storeBreakdown]);

  // ── 賞クロス集計（店舗 or フロア） ────────────────────────────────────────
  const prizeCrossTab = useMemo(() => {
    if (prizeBreakdown === 'none') return null;
    const cells: Record<string, Record<string, number>> = {};
    const colSet = new Set<string>();
    const slotsByCol: Record<string, number> = {};

    filteredLogs.forEach((l) => {
      const col = prizeBreakdown === 'store' ? l.store_name : l.floor;
      colSet.add(col);
      slotsByCol[col] = (slotsByCol[col] || 0) + l.slot_count;
      Object.entries(l.prizes).forEach(([pid, cnt]) => {
        if (!cells[pid]) cells[pid] = {};
        cells[pid][col] = (cells[pid][col] || 0) + cnt;
      });
    });

    const cols = prizeBreakdown === 'floor'
      ? FLOORS.filter(f => colSet.has(f))
      : Array.from(colSet).sort();

    // ハズレ行
    cells['miss'] = {};
    cols.forEach(col => {
      const totalWins = prizes.reduce((s, p) => s + (cells[p.prize_id]?.[col] || 0), 0);
      cells['miss'][col] = Math.max(0, (slotsByCol[col] || 0) - totalWins);
    });

    return { cells, cols };
  }, [filteredLogs, prizeBreakdown, prizes]);

  const maxHourly = Math.max(...hourlyData.map(([, d]) => hourlyMode === 'count' ? d.count : d.slots), 1);

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
            受信
          </button>
          <button
            onClick={handleSend}
            disabled={isSyncing || unsyncedCount === 0}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50 ${
              unsyncedCount > 0
                ? 'bg-yellow-500 text-white active:bg-yellow-600'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <Send size={16} />
            {unsyncedCount > 0 ? `未送信${unsyncedCount}件` : '送信'}
          </button>
        </div>
        {message && (
          <div className="text-sm text-brand-600 font-medium">{message}</div>
        )}

        {/* Sub-tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([['logs', '全ログ'], ['hourly', '時間別'], ['stores', '店舗別'], ['prizes', '賞集計'], ['qr', 'QR']] as [SubTab, string][]).map(([key, label]) => (
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
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-700">1時間ごとの集計</h3>
              <div className="flex gap-1 bg-gray-100 rounded-xl p-0.5">
                {(['count', 'slots'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setHourlyMode(mode)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      hourlyMode === mode ? 'bg-white text-brand-700 shadow' : 'text-gray-500'
                    }`}
                  >
                    {mode === 'count' ? '登録件数' : 'スロット回数'}
                  </button>
                ))}
              </div>
            </div>
            <BreakdownSelector
              value={hourlyBreakdown}
              onChange={setHourlyBreakdown}
              options={[['none', 'なし'], ['store', '店舗別'], ['floor', 'フロア別']]}
            />
            <div className="mt-3">
              {hourlyBreakdown === 'none' ? (
                <div className="space-y-2">
                  {hourlyData.length === 0 && <p className="text-center text-gray-400 py-6">データなし</p>}
                  {hourlyData.map(([hour, data]) => {
                    const value = hourlyMode === 'count' ? data.count : data.slots;
                    const sub   = hourlyMode === 'count' ? `${data.slots}回` : `${data.count}件`;
                    return (
                      <div key={hour} className="flex items-center gap-3">
                        <span className="w-14 text-sm text-gray-500 tabular-nums text-right">{hour}:00〜</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                          <div
                            className="bg-brand-500 h-full rounded-full flex items-center px-2 transition-all"
                            style={{ width: `${(value / maxHourly) * 100}%`, minWidth: '2.5rem' }}
                          >
                            <span className="text-white text-xs font-bold whitespace-nowrap">{value}</span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 tabular-nums w-10 text-right">{sub}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                hourlyCrossTab
                  ? <CrossTabTable data={hourlyCrossTab} mode={hourlyMode} rowLabel="時間帯" formatRow={h => `${h}:00〜`} />
                  : <p className="text-center text-gray-400 py-6">データなし</p>
              )}
            </div>
          </div>
        )}

        {/* 店舗別 */}
        {subTab === 'stores' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 pb-2">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-700">店舗ごとの集計</h3>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-0.5">
                  {(['count', 'slots'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setStoreMode(mode)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                        storeMode === mode ? 'bg-white text-brand-700 shadow' : 'text-gray-500'
                      }`}
                    >
                      {mode === 'count' ? '登録件数' : 'スロット回数'}
                    </button>
                  ))}
                </div>
              </div>
              <BreakdownSelector
                value={storeBreakdown}
                onChange={setStoreBreakdown}
                options={[['none', 'なし'], ['hour', '時間別'], ['floor', 'フロア別']]}
              />
            </div>

            {/* 内訳なし：既存リスト */}
            {storeBreakdown === 'none' && (
              <>
                {storeData.length === 0 && <p className="text-center text-gray-400 py-6">データなし</p>}
                {storeData.map((s, i) => (
                  <div key={i} className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.floor}</div>
                    </div>
                    <div className="text-right">
                      {storeMode === 'count' ? (
                        <>
                          <div className="font-bold text-brand-600">{s.count}件</div>
                          <div className="text-xs text-gray-400">計{s.slots}回</div>
                        </>
                      ) : (
                        <>
                          <div className="font-bold text-brand-600">{s.slots}回</div>
                          <div className="text-xs text-gray-400">{s.count}件来店</div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* 内訳：時間別クロス集計 */}
            {storeBreakdown === 'hour' && (
              <div className="p-4 pt-2">
                {storeCrossTab
                  ? <CrossTabTable data={storeCrossTab} mode={storeMode} rowLabel="店舗" />
                  : <p className="text-center text-gray-400 py-6">データなし</p>
                }
              </div>
            )}

            {/* 内訳：フロア別グループ */}
            {storeBreakdown === 'floor' && (
              <>
                {!storeByFloor || storeByFloor.length === 0
                  ? <p className="text-center text-gray-400 py-6">データなし</p>
                  : storeByFloor.map(({ floor, stores }) => (
                    <div key={floor}>
                      <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100">
                        <span className="text-xs font-bold text-gray-500 tracking-wide">{floor}</span>
                      </div>
                      {stores.map((s, i) => (
                        <div key={i} className="px-4 py-3 border-b border-gray-50 flex items-center justify-between pl-6">
                          <div className="text-sm font-medium text-gray-800">{s.name}</div>
                          <div className="text-right">
                            {storeMode === 'count' ? (
                              <>
                                <div className="font-bold text-brand-600">{s.count}件</div>
                                <div className="text-xs text-gray-400">計{s.slots}回</div>
                              </>
                            ) : (
                              <>
                                <div className="font-bold text-brand-600">{s.slots}回</div>
                                <div className="text-xs text-gray-400">{s.count}件来店</div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                }
              </>
            )}
          </div>
        )}

        {/* 賞集計 */}
        {subTab === 'prizes' && (
          <div className="space-y-3">
            {/* 割合バーチャート or クロス集計 */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-700">賞ごとの集計</h3>
              </div>
              <BreakdownSelector
                value={prizeBreakdown}
                onChange={setPrizeBreakdown}
                options={[['none', 'なし'], ['store', '店舗別'], ['floor', 'フロア別']]}
              />
              <div className="mt-3">
                {prizeBreakdown === 'none' ? (
                  prizeData.totalSlots === 0 ? (
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
                  )
                ) : (
                  prizeCrossTab ? (
                    <PrizeCrossTabTable
                      prizeRows={[
                        ...prizes.sort((a, b) => a.order - b.order).map(p => ({ id: p.prize_id, name: p.name })),
                        { id: 'miss', name: 'ハズレ', isMiss: true },
                      ]}
                      cols={prizeCrossTab.cols}
                      cells={prizeCrossTab.cells}
                    />
                  ) : (
                    <p className="text-center text-gray-400 py-4">データなし</p>
                  )
                )}
              </div>
            </div>

            {/* 総合計（内訳なし時のみ表示） */}
            {prizeBreakdown === 'none' && (
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
            )}
          </div>
        )}

        {/* QR */}
        {subTab === 'qr' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-4">
            <h3 className="font-bold text-gray-700 text-lg">登録画面を開く</h3>
            <QRCodeSVG value={REGISTER_URL} size={220} />
            <p className="text-sm text-gray-500 text-center break-all">{REGISTER_URL}</p>
          </div>
        )}
      </div>
    </div>
  );
}
