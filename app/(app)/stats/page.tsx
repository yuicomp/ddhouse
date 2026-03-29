'use client';
import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import type { LogEntry } from '@/lib/types';
import { RefreshCw, Send, ChevronLeft, ChevronRight, ChevronDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

type SubTab = 'logs' | 'hourly' | 'stores' | 'prizes';
type HourlyBreakdown = 'none' | 'store' | 'floor' | 'prize';
type StoreBreakdown  = 'none' | 'hour'  | 'floor' | 'prize';
type PrizeBreakdown  = 'none' | 'store' | 'floor' | 'hour';

const FLOORS = ['B1F', '1F', '2F', '3F'];

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

// ─── カレンダーピッカー ───────────────────────────────────────────────────────
function CalendarPicker({
  selectedDate, onSelect, datesWithData, today,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
  datesWithData: Set<string>;
  today: string;
}) {
  const [selY, selM] = selectedDate.split('-').map(Number);
  const [dispYear, setDispYear] = useState(selY);
  const [dispMonth, setDispMonth] = useState(selM);

  useEffect(() => {
    const [y, m] = selectedDate.split('-').map(Number);
    setDispYear(y);
    setDispMonth(m);
  }, [selectedDate]);

  const [todayY, todayM] = today.split('-').map(Number);
  const canGoNext = dispYear < todayY || (dispYear === todayY && dispMonth < todayM);

  function prevMonth() {
    if (dispMonth === 1) { setDispYear(y => y - 1); setDispMonth(12); }
    else setDispMonth(m => m - 1);
  }
  function nextMonth() {
    if (!canGoNext) return;
    if (dispMonth === 12) { setDispYear(y => y + 1); setDispMonth(1); }
    else setDispMonth(m => m + 1);
  }

  const daysInMonth   = new Date(dispYear, dispMonth, 0).getDate();
  const firstDayOfWeek = new Date(dispYear, dispMonth - 1, 1).getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white border-b border-gray-100 px-4 pb-3 pt-1">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="p-2 text-gray-500 active:text-gray-900">
          <ChevronLeft size={18} />
        </button>
        <span className="font-bold text-gray-700 text-sm">{dispYear}年{dispMonth}月</span>
        <button onClick={nextMonth} disabled={!canGoNext} className="p-2 text-gray-500 active:text-gray-900 disabled:opacity-30">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-1">
        {['日','月','火','水','木','金','土'].map(d => <div key={d} className="py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const dateStr = `${dispYear}-${String(dispMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isSelected = dateStr === selectedDate;
          const hasData    = datesWithData.has(dateStr);
          const isFuture   = dateStr > today;
          const isToday    = dateStr === today;
          return (
            <button
              key={day}
              onClick={() => !isFuture && onSelect(dateStr)}
              disabled={isFuture}
              className={`relative flex flex-col items-center justify-center h-9 rounded-lg text-sm transition ${
                isSelected ? 'bg-brand-600 text-white font-bold' :
                isToday    ? 'text-brand-600 font-bold' :
                isFuture   ? 'text-gray-200' :
                             'text-gray-700 active:bg-gray-100'
              }`}
            >
              {day}
              {hasData && (
                <span className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/80' : 'bg-red-500'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── クロス集計テーブル（count/slots 切替型） ────────────────────────────────
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
            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap border-b border-r border-gray-100">{rowLabel}</th>
            {cols.map(col => (
              <th key={col} className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap min-w-14 border-b border-gray-100">{col}</th>
            ))}
            <th className="px-2 py-2 text-center text-brand-600 font-bold whitespace-nowrap border-b border-l border-gray-100">合計</th>
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
              <td className="px-2 py-2 text-center font-bold text-brand-600 tabular-nums border-l border-gray-100">{rowTotals[i]}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-brand-50 border-t-2 border-brand-100">
            <td className="sticky left-0 z-10 bg-brand-50 px-3 py-2 text-brand-700 font-bold border-r border-brand-100">合計</td>
            {cols.map((col, j) => (
              <td key={col} className="px-2 py-2 text-center font-bold text-brand-600 tabular-nums">{colTotals[j]}</td>
            ))}
            <td className="px-2 py-2 text-center font-bold text-brand-700 tabular-nums border-l border-brand-100">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── 賞クロス集計テーブル（賞が列の既存型） ──────────────────────────────────
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

  if (prizeRows.length === 0 || cols.length === 0) return <p className="text-center text-gray-400 py-6">データなし</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap border-b border-r border-gray-100">賞</th>
            {cols.map(col => (
              <th key={col} className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap min-w-14 border-b border-gray-100">{col}</th>
            ))}
            <th className="px-2 py-2 text-center text-brand-600 font-bold whitespace-nowrap border-b border-l border-gray-100">合計</th>
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
              <td className="px-2 py-2 text-center font-bold text-brand-600 tabular-nums border-l border-gray-100">{rowTotals[i]}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-brand-50 border-t-2 border-brand-100">
            <td className="sticky left-0 z-10 bg-brand-50 px-3 py-2 text-brand-700 font-bold border-r border-brand-100">合計</td>
            {cols.map((col, j) => (
              <td key={col} className="px-2 py-2 text-center font-bold text-brand-600 tabular-nums">{colTotals[j]}</td>
            ))}
            <td className="px-2 py-2 text-center font-bold text-brand-700 tabular-nums border-l border-brand-100">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── 賞クロス集計テーブル（賞が列、行=時間/店舗） ────────────────────────────
function PrizeColsCrossTab({
  rows, cells, rowSlots, prizes, rowHeaderLabel,
}: {
  rows: { key: string; label: string }[];
  cells: Record<string, Record<string, number>>;
  rowSlots: Record<string, number>;
  prizes: { prize_id: string; name: string; order: number }[];
  rowHeaderLabel: string;
}) {
  const sortedPrizes = [...prizes].sort((a, b) => a.order - b.order);

  const getMiss = (key: string) => {
    const wins = sortedPrizes.reduce((s, p) => s + (cells[key]?.[p.prize_id] || 0), 0);
    return Math.max(0, (rowSlots[key] || 0) - wins);
  };
  const getP = (key: string, pid: string) => cells[key]?.[pid] || 0;

  const rowTotals   = rows.map(r => rowSlots[r.key] || 0);
  const prizeTotals = sortedPrizes.map(p => rows.reduce((s, r) => s + getP(r.key, p.prize_id), 0));
  const missTotal   = rows.reduce((s, r) => s + getMiss(r.key), 0);
  const grandTotal  = rowTotals.reduce((a, b) => a + b, 0);

  if (rows.length === 0) return <p className="text-center text-gray-400 py-6">データなし</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap border-b border-r border-gray-100">{rowHeaderLabel}</th>
            {sortedPrizes.map(p => (
              <th key={p.prize_id} className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap min-w-14 border-b border-gray-100">{p.name}</th>
            ))}
            <th className="px-2 py-2 text-center text-gray-400 font-medium whitespace-nowrap min-w-14 border-b border-gray-100">ハズレ</th>
            <th className="px-2 py-2 text-center text-brand-600 font-bold whitespace-nowrap border-b border-l border-gray-100">合計</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const miss = getMiss(row.key);
            return (
              <tr key={row.key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2 text-gray-700 font-medium whitespace-nowrap border-r border-gray-100">{row.label}</td>
                {sortedPrizes.map(p => {
                  const v = getP(row.key, p.prize_id);
                  return (
                    <td key={p.prize_id} className={`px-2 py-2 text-center tabular-nums ${v > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                      {v > 0 ? v : '—'}
                    </td>
                  );
                })}
                <td className={`px-2 py-2 text-center tabular-nums ${miss > 0 ? 'text-gray-400' : 'text-gray-300'}`}>
                  {miss > 0 ? miss : '—'}
                </td>
                <td className="px-2 py-2 text-center font-bold text-brand-600 tabular-nums border-l border-gray-100">{rowTotals[i]}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-brand-50 border-t-2 border-brand-100">
            <td className="sticky left-0 z-10 bg-brand-50 px-3 py-2 text-brand-700 font-bold border-r border-brand-100">合計</td>
            {prizeTotals.map((t, j) => (
              <td key={sortedPrizes[j].prize_id} className="px-2 py-2 text-center font-bold text-brand-600 tabular-nums">{t}</td>
            ))}
            <td className="px-2 py-2 text-center font-bold text-gray-400 tabular-nums">{missTotal}</td>
            <td className="px-2 py-2 text-center font-bold text-brand-700 tabular-nums border-l border-brand-100">{grandTotal}</td>
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
      <div className="flex gap-0.5 bg-gray-100 rounded-xl p-0.5 flex-1">
        {options.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex-1 px-1.5 py-1 rounded-lg text-xs font-medium transition ${
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
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>('logs');
  const [message, setMessage] = useState('');
  const [hourlyMode, setHourlyMode] = useState<'count' | 'slots'>('count');
  const [storeMode,  setStoreMode]  = useState<'count' | 'slots'>('count');

  const [hourlyBreakdown, setHourlyBreakdown] = useState<HourlyBreakdown>('none');
  const [storeBreakdown,  setStoreBreakdown]  = useState<StoreBreakdown>('none');
  const [prizeBreakdown,  setPrizeBreakdown]  = useState<PrizeBreakdown>('none');

  // 選択日の永続化
  useEffect(() => {
    const saved = localStorage.getItem('ddh_stats_date');
    if (saved) setSelectedDate(saved);
  }, []);

  function selectDate(date: string) {
    setSelectedDate(date);
    localStorage.setItem('ddh_stats_date', date);
    setCalendarOpen(false);
  }

  // ── フィルタ ──────────────────────────────────────────────────────────────
  const filteredLogs = useMemo(
    () => logs.filter((l) => l.timestamp.startsWith(selectedDate)),
    [logs, selectedDate]
  );

  const datesWithData = useMemo(
    () => new Set(logs.map(l => l.timestamp.substring(0, 10))),
    [logs]
  );

  const unsyncedCount = useMemo(
    () => logs.filter((l) => !l.synced && !l.from_remote).length,
    [logs]
  );

  // ── 同期 ──────────────────────────────────────────────────────────────────
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
    return Object.entries(map).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
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
    if (hourlyBreakdown !== 'store' && hourlyBreakdown !== 'floor') return null;
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
    const rows = Object.keys(cells).sort((a, b) => parseInt(a) - parseInt(b));
    const cols = hourlyBreakdown === 'floor'
      ? FLOORS.filter(f => colSet.has(f))
      : Array.from(colSet).sort();
    return { rows, cols, cells };
  }, [filteredLogs, hourlyBreakdown]);

  // ── 時間別 × 賞別 ─────────────────────────────────────────────────────────
  const hourlyPrizeCrossTab = useMemo(() => {
    if (hourlyBreakdown !== 'prize') return null;
    const cells: Record<string, Record<string, number>> = {};
    const rowSlots: Record<string, number> = {};
    filteredLogs.forEach(l => {
      const h = getHourJST(l.timestamp);
      if (!cells[h]) cells[h] = {};
      rowSlots[h] = (rowSlots[h] || 0) + l.slot_count;
      Object.entries(l.prizes).forEach(([pid, cnt]) => {
        cells[h][pid] = (cells[h][pid] || 0) + cnt;
      });
    });
    const rows = Object.keys(cells)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(h => ({ key: h, label: `${h}:00〜` }));
    return { rows, cells, rowSlots };
  }, [filteredLogs, hourlyBreakdown]);

  // ── 店舗別 × 時間別クロス集計 ─────────────────────────────────────────────
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
    const cols = Array.from(colSet).sort((a, b) => parseInt(a) - parseInt(b));
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
    return FLOORS.filter(f => grouped[f]?.length > 0).map(f => ({ floor: f, stores: grouped[f] }));
  }, [storeData, storeBreakdown]);

  // ── 店舗別 × 賞別 ─────────────────────────────────────────────────────────
  const storePrizeCrossTab = useMemo(() => {
    if (storeBreakdown !== 'prize') return null;
    const cells: Record<string, Record<string, number>> = {};
    const rowSlots: Record<string, number> = {};
    filteredLogs.forEach(l => {
      const row = l.store_name;
      if (!cells[row]) cells[row] = {};
      rowSlots[row] = (rowSlots[row] || 0) + l.slot_count;
      Object.entries(l.prizes).forEach(([pid, cnt]) => {
        cells[row][pid] = (cells[row][pid] || 0) + cnt;
      });
    });
    const rows = Object.keys(cells)
      .sort((a, b) => (rowSlots[b] || 0) - (rowSlots[a] || 0))
      .map(s => ({ key: s, label: s }));
    return { rows, cells, rowSlots };
  }, [filteredLogs, storeBreakdown]);

  // ── 賞集計 × 店舗/フロア ──────────────────────────────────────────────────
  const prizeCrossTab = useMemo(() => {
    if (prizeBreakdown !== 'store' && prizeBreakdown !== 'floor') return null;
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
    cells['miss'] = {};
    cols.forEach(col => {
      const wins = prizes.reduce((s, p) => s + (cells[p.prize_id]?.[col] || 0), 0);
      cells['miss'][col] = Math.max(0, (slotsByCol[col] || 0) - wins);
    });
    return { cells, cols };
  }, [filteredLogs, prizeBreakdown, prizes]);

  // ── 賞集計 × 時間別 ───────────────────────────────────────────────────────
  const prizeHourlyCrossTab = useMemo(() => {
    if (prizeBreakdown !== 'hour') return null;
    const rawCells: Record<string, Record<string, number>> = {};
    const slotsByHour: Record<string, number> = {};
    const hourSet = new Set<string>();
    filteredLogs.forEach(l => {
      const h = getHourJST(l.timestamp);
      const col = `${h}:00〜`;
      hourSet.add(h);
      slotsByHour[h] = (slotsByHour[h] || 0) + l.slot_count;
      Object.entries(l.prizes).forEach(([pid, cnt]) => {
        if (!rawCells[pid]) rawCells[pid] = {};
        rawCells[pid][col] = (rawCells[pid][col] || 0) + cnt;
      });
    });
    const sortedHours = Array.from(hourSet).sort((a, b) => parseInt(a) - parseInt(b));
    const cols = sortedHours.map(h => `${h}:00〜`);
    const cells: Record<string, Record<string, number>> = { ...rawCells, miss: {} };
    cols.forEach((col, i) => {
      const h = sortedHours[i];
      const wins = prizes.reduce((s, p) => s + (rawCells[p.prize_id]?.[col] || 0), 0);
      cells['miss'][col] = Math.max(0, (slotsByHour[h] || 0) - wins);
    });
    return { cells, cols };
  }, [filteredLogs, prizeBreakdown, prizes]);

  const maxHourly = Math.max(...hourlyData.map(([, d]) => hourlyMode === 'count' ? d.count : d.slots), 1);

  // ── Excelエクスポート ──────────────────────────────────────────────────────
  function exportToExcel() {
    const sortedPrizes = [...prizes].sort((a, b) => a.order - b.order);
    let sheetData: (string | number)[][] = [];
    let sheetName = '';

    if (subTab === 'logs') {
      sheetName = '全ログ';
      sheetData = [
        ['時刻', '店舗', 'フロア', 'レシート金額(円)', 'スロット回数', ...sortedPrizes.map(p => p.name), '同期状態'],
        ...filteredLogs.map(l => [
          toTimeJST(l.timestamp),
          l.store_name,
          l.floor,
          l.receipt_amount,
          l.slot_count,
          ...sortedPrizes.map(p => l.prizes[p.prize_id] || 0),
          l.from_remote ? '他端末' : l.synced ? '送信済' : '未送信',
        ]),
      ];

    } else if (subTab === 'hourly') {
      if (hourlyBreakdown === 'none') {
        sheetName = '時間別';
        sheetData = [
          ['時間帯', '登録件数', 'スロット回数'],
          ...hourlyData.map(([h, d]) => [`${h}:00〜`, d.count, d.slots]),
          ['合計', filteredLogs.length, filteredLogs.reduce((a, b) => a + b.slot_count, 0)],
        ];
      } else if ((hourlyBreakdown === 'store' || hourlyBreakdown === 'floor') && hourlyCrossTab) {
        sheetName = `時間別_${hourlyBreakdown === 'store' ? '店舗別' : 'フロア別'}`;
        const { rows, cols, cells } = hourlyCrossTab;
        const get = (r: string, c: string) => { const v = cells[r]?.[c]; return v ? (hourlyMode === 'count' ? v.count : v.slots) : 0; };
        sheetData = [
          ['時間帯', ...cols, '合計'],
          ...rows.map(r => [`${r}:00〜`, ...cols.map(c => get(r, c)), cols.reduce((s, c) => s + get(r, c), 0)]),
          ['合計', ...cols.map(c => rows.reduce((s, r) => s + get(r, c), 0)), rows.reduce((s, r) => s + cols.reduce((ss, c) => ss + get(r, c), 0), 0)],
        ];
      } else if (hourlyBreakdown === 'prize' && hourlyPrizeCrossTab) {
        sheetName = '時間別_賞別';
        const { rows, cells, rowSlots } = hourlyPrizeCrossTab;
        sheetData = [
          ['時間帯', ...sortedPrizes.map(p => p.name), 'ハズレ', 'スロット合計'],
          ...rows.map(r => {
            const wins = sortedPrizes.reduce((s, p) => s + (cells[r.key]?.[p.prize_id] || 0), 0);
            return [r.label, ...sortedPrizes.map(p => cells[r.key]?.[p.prize_id] || 0), Math.max(0, (rowSlots[r.key] || 0) - wins), rowSlots[r.key] || 0];
          }),
          ['合計',
            ...sortedPrizes.map(p => rows.reduce((s, r) => s + (cells[r.key]?.[p.prize_id] || 0), 0)),
            rows.reduce((s, r) => { const w = sortedPrizes.reduce((ss, p) => ss + (cells[r.key]?.[p.prize_id] || 0), 0); return s + Math.max(0, (rowSlots[r.key] || 0) - w); }, 0),
            rows.reduce((s, r) => s + (rowSlots[r.key] || 0), 0),
          ],
        ];
      }

    } else if (subTab === 'stores') {
      if (storeBreakdown === 'none') {
        sheetName = '店舗別';
        sheetData = [
          ['店舗', 'フロア', '登録件数', 'スロット回数'],
          ...storeData.map(s => [s.name, s.floor, s.count, s.slots]),
          ['合計', '', storeData.reduce((a, s) => a + s.count, 0), storeData.reduce((a, s) => a + s.slots, 0)],
        ];
      } else if (storeBreakdown === 'hour' && storeCrossTab) {
        sheetName = '店舗別_時間別';
        const { rows, cols, cells } = storeCrossTab;
        const get = (r: string, c: string) => { const v = cells[r]?.[c]; return v ? (storeMode === 'count' ? v.count : v.slots) : 0; };
        sheetData = [
          ['店舗', ...cols, '合計'],
          ...rows.map(r => [r, ...cols.map(c => get(r, c)), cols.reduce((s, c) => s + get(r, c), 0)]),
          ['合計', ...cols.map(c => rows.reduce((s, r) => s + get(r, c), 0)), rows.reduce((s, r) => s + cols.reduce((ss, c) => ss + get(r, c), 0), 0)],
        ];
      } else if (storeBreakdown === 'floor' && storeByFloor) {
        sheetName = '店舗別_フロア別';
        sheetData = [['フロア', '店舗', '登録件数', 'スロット回数']];
        storeByFloor.forEach(({ floor, stores }) => {
          stores.forEach(s => sheetData.push([floor, s.name, s.count, s.slots]));
        });
        sheetData.push(['合計', '', storeData.reduce((a, s) => a + s.count, 0), storeData.reduce((a, s) => a + s.slots, 0)]);
      } else if (storeBreakdown === 'prize' && storePrizeCrossTab) {
        sheetName = '店舗別_賞別';
        const { rows, cells, rowSlots } = storePrizeCrossTab;
        sheetData = [
          ['店舗', ...sortedPrizes.map(p => p.name), 'ハズレ', 'スロット合計'],
          ...rows.map(r => {
            const wins = sortedPrizes.reduce((s, p) => s + (cells[r.key]?.[p.prize_id] || 0), 0);
            return [r.label, ...sortedPrizes.map(p => cells[r.key]?.[p.prize_id] || 0), Math.max(0, (rowSlots[r.key] || 0) - wins), rowSlots[r.key] || 0];
          }),
          ['合計',
            ...sortedPrizes.map(p => rows.reduce((s, r) => s + (cells[r.key]?.[p.prize_id] || 0), 0)),
            rows.reduce((s, r) => { const w = sortedPrizes.reduce((ss, p) => ss + (cells[r.key]?.[p.prize_id] || 0), 0); return s + Math.max(0, (rowSlots[r.key] || 0) - w); }, 0),
            rows.reduce((s, r) => s + (rowSlots[r.key] || 0), 0),
          ],
        ];
      }

    } else if (subTab === 'prizes') {
      const prizeRows = [...sortedPrizes.map(p => ({ id: p.prize_id, name: p.name })), { id: 'miss', name: 'ハズレ' }];
      if (prizeBreakdown === 'none') {
        sheetName = '賞集計';
        sheetData = [
          ['賞', '回数', '割合(%)'],
          ...sortedPrizes.map(p => {
            const cnt = prizeData.map[p.prize_id] || 0;
            return [p.name, cnt, prizeData.totalSlots > 0 ? parseFloat((cnt / prizeData.totalSlots * 100).toFixed(1)) : 0];
          }),
          ['ハズレ', Math.max(0, prizeData.miss), prizeData.totalSlots > 0 ? parseFloat((Math.max(0, prizeData.miss) / prizeData.totalSlots * 100).toFixed(1)) : 0],
          ['スロット合計', prizeData.totalSlots, 100],
        ];
      } else if ((prizeBreakdown === 'store' || prizeBreakdown === 'floor') && prizeCrossTab) {
        sheetName = `賞集計_${prizeBreakdown === 'store' ? '店舗別' : 'フロア別'}`;
        const { cols, cells } = prizeCrossTab;
        sheetData = [
          ['賞', ...cols, '合計'],
          ...prizeRows.map(p => [p.name, ...cols.map(c => cells[p.id]?.[c] || 0), cols.reduce((s, c) => s + (cells[p.id]?.[c] || 0), 0)]),
          ['合計', ...cols.map(c => prizeRows.reduce((s, p) => s + (cells[p.id]?.[c] || 0), 0)), prizeRows.reduce((s, p) => s + cols.reduce((ss, c) => ss + (cells[p.id]?.[c] || 0), 0), 0)],
        ];
      } else if (prizeBreakdown === 'hour' && prizeHourlyCrossTab) {
        sheetName = '賞集計_時間別';
        const { cols, cells } = prizeHourlyCrossTab;
        sheetData = [
          ['賞', ...cols, '合計'],
          ...prizeRows.map(p => [p.name, ...cols.map(c => cells[p.id]?.[c] || 0), cols.reduce((s, c) => s + (cells[p.id]?.[c] || 0), 0)]),
          ['合計', ...cols.map(c => prizeRows.reduce((s, p) => s + (cells[p.id]?.[c] || 0), 0)), prizeRows.reduce((s, p) => s + cols.reduce((ss, c) => ss + (cells[p.id]?.[c] || 0), 0), 0)],
        ];
      }
    }

    if (sheetData.length === 0) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `ddhouse_${selectedDate}_${sheetName}.xlsx`);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="bg-white shadow-sm flex-shrink-0">
        <div className="px-4 pt-3 pb-2 space-y-2">
          <div className="flex items-center gap-2">
            {/* 日付ボタン（カレンダートグル） */}
            <button
              onClick={() => setCalendarOpen(o => !o)}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-base flex items-center justify-between focus:outline-none focus:border-brand-500"
            >
              <span className="text-gray-800">{selectedDate}</span>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${calendarOpen ? 'rotate-180' : ''}`} />
            </button>
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
          {message && <div className="text-sm text-brand-600 font-medium">{message}</div>}

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

        {/* カレンダー */}
        {calendarOpen && (
          <CalendarPicker
            selectedDate={selectedDate}
            onSelect={selectDate}
            datesWithData={datesWithData}
            today={today}
          />
        )}
      </div>

      {/* Summary bar */}
      <div className="bg-brand-50 px-4 py-2 flex items-center gap-4 text-sm flex-shrink-0">
        <span className="text-gray-600">登録 <b className="text-brand-700">{filteredLogs.length}件</b></span>
        <span className="text-gray-600">スロット <b className="text-brand-700">{filteredLogs.reduce((a, b) => a + b.slot_count, 0)}回</b></span>
        <button
          onClick={exportToExcel}
          disabled={filteredLogs.length === 0}
          className="ml-auto flex items-center gap-1 px-3 py-1 bg-white text-gray-600 rounded-lg text-xs font-medium border border-gray-200 active:bg-gray-50 disabled:opacity-40"
        >
          <Download size={13} />
          エクスポート
        </button>
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
              options={[['none', 'なし'], ['store', '店舗別'], ['floor', 'フロア別'], ['prize', '賞別']]}
            />
            <div className="mt-3">
              {hourlyBreakdown === 'none' && (
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
              )}
              {(hourlyBreakdown === 'store' || hourlyBreakdown === 'floor') && (
                hourlyCrossTab
                  ? <CrossTabTable data={hourlyCrossTab} mode={hourlyMode} rowLabel="時間帯" formatRow={h => `${h}:00〜`} />
                  : <p className="text-center text-gray-400 py-6">データなし</p>
              )}
              {hourlyBreakdown === 'prize' && (
                hourlyPrizeCrossTab
                  ? <PrizeColsCrossTab rows={hourlyPrizeCrossTab.rows} cells={hourlyPrizeCrossTab.cells} rowSlots={hourlyPrizeCrossTab.rowSlots} prizes={prizes} rowHeaderLabel="時間帯" />
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
                options={[['none', 'なし'], ['hour', '時間別'], ['floor', 'フロア別'], ['prize', '賞別']]}
              />
            </div>

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

            {storeBreakdown === 'hour' && (
              <div className="p-4 pt-2">
                {storeCrossTab
                  ? <CrossTabTable data={storeCrossTab} mode={storeMode} rowLabel="店舗" />
                  : <p className="text-center text-gray-400 py-6">データなし</p>
                }
              </div>
            )}

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

            {storeBreakdown === 'prize' && (
              <div className="p-4 pt-2">
                {storePrizeCrossTab
                  ? <PrizeColsCrossTab rows={storePrizeCrossTab.rows} cells={storePrizeCrossTab.cells} rowSlots={storePrizeCrossTab.rowSlots} prizes={prizes} rowHeaderLabel="店舗" />
                  : <p className="text-center text-gray-400 py-6">データなし</p>
                }
              </div>
            )}
          </div>
        )}

        {/* 賞集計 */}
        {subTab === 'prizes' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-700">賞ごとの集計</h3>
              </div>
              <BreakdownSelector
                value={prizeBreakdown}
                onChange={setPrizeBreakdown}
                options={[['none', 'なし'], ['store', '店舗別'], ['floor', 'フロア別'], ['hour', '時間別']]}
              />
              <div className="mt-3">
                {prizeBreakdown === 'none' && (
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
                              <div className="bg-brand-500 h-full rounded-full transition-all" style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }} />
                            </div>
                          </div>
                        );
                      })}
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
                              <div className="bg-gray-300 h-full rounded-full transition-all" style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )
                )}
                {(prizeBreakdown === 'store' || prizeBreakdown === 'floor') && (
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
                {prizeBreakdown === 'hour' && (
                  prizeHourlyCrossTab ? (
                    <PrizeCrossTabTable
                      prizeRows={[
                        ...prizes.sort((a, b) => a.order - b.order).map(p => ({ id: p.prize_id, name: p.name })),
                        { id: 'miss', name: 'ハズレ', isMiss: true },
                      ]}
                      cols={prizeHourlyCrossTab.cols}
                      cells={prizeHourlyCrossTab.cells}
                    />
                  ) : (
                    <p className="text-center text-gray-400 py-4">データなし</p>
                  )
                )}
              </div>
            </div>

            {/* 総合計（内訳なし時のみ） */}
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
      </div>
    </div>
  );
}
