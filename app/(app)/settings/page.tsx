'use client';
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { INITIAL_SHOPS } from '@/lib/initial-shops';
import { Shop, Prize, Floor } from '@/lib/types';
import { Trash2, Plus, LogOut, RefreshCw, AlertTriangle } from 'lucide-react';

function todayJST(): string {
  return new Date().toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\//g, '-');
}
function getHourJST(ts: string): string {
  return new Date(ts)
    .toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit' })
    .replace('時', '')
    .padStart(2, '0');
}

const FLOORS: Floor[] = ['B1F', '1F', '2F', '3F'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="bg-brand-50 px-4 py-2 border-b border-brand-100">
        <h3 className="font-bold text-brand-800 text-sm">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const {
    deviceId, deviceLabel, gasUrl, shops, prizes, logs,
    setDeviceLabel, setGasUrl, updateShop, deleteShop, setShops,
    setPrizes, fetchRemoteSettings, isSyncing, logout, deleteLogs,
  } = useApp();

  const [labelInput, setLabelInput] = useState(deviceLabel);
  const [gasInput, setGasInput] = useState(gasUrl);
  const [sheetInput, setSheetInput] = useState('');
  const [syncMsg, setSyncMsg] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    setSheetInput(localStorage.getItem('ddh_spreadsheet_url') || '');
  }, []);

  // Shop edit state
  const [newShopName, setNewShopName] = useState('');
  const [newShopFloor, setNewShopFloor] = useState<Floor>('1F');
  const [editingShop, setEditingShop] = useState<Shop | null>(null);

  // Prize edit state
  const [newPrizeName, setNewPrizeName] = useState('');

  // Data management state
  const [deleteState, setDeleteState] = useState<'idle' | 'confirm_today' | 'confirm_hour'>('idle');
  const [deleteHour, setDeleteHour] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');

  const today = useMemo(() => todayJST(), []);
  const todayLogs = useMemo(() => logs.filter((l) => l.timestamp.startsWith(today)), [logs, today]);
  const hoursWithData = useMemo(
    () => Array.from(new Set(todayLogs.map((l) => getHourJST(l.timestamp)))).sort(),
    [todayLogs]
  );

  async function handleDeleteToday() {
    const ids = todayLogs.map((l) => l.log_id);
    if (ids.length === 0) return;
    setIsDeleting(true);
    try {
      const result = await deleteLogs(ids);
      setDeleteMsg(result.error ? `⚠️ スプシエラー: ${result.error}（ローカルは削除済み）` : `✅ ${ids.length}件を削除しました`);
    } finally {
      setIsDeleting(false);
      setDeleteState('idle');
      setTimeout(() => setDeleteMsg(''), 5000);
    }
  }

  async function handleDeleteHour() {
    const hourLogs = todayLogs.filter((l) => getHourJST(l.timestamp) === deleteHour);
    const ids = hourLogs.map((l) => l.log_id);
    if (ids.length === 0) return;
    setIsDeleting(true);
    try {
      const result = await deleteLogs(ids);
      setDeleteMsg(result.error ? `⚠️ スプシエラー: ${result.error}（ローカルは削除済み）` : `✅ ${ids.length}件を削除しました`);
      setDeleteHour('');
    } finally {
      setIsDeleting(false);
      setDeleteState('idle');
      setTimeout(() => setDeleteMsg(''), 5000);
    }
  }

  useEffect(() => { setLabelInput(deviceLabel); }, [deviceLabel]);
  useEffect(() => { setGasInput(gasUrl); }, [gasUrl]);

  function saveLabel() {
    setDeviceLabel(labelInput);
    flash('端末名を保存しました');
  }
  function saveGas() {
    setGasUrl(gasInput.trim());
    flash('GAS URLを保存しました');
  }
  function saveSheet() {
    localStorage.setItem('ddh_spreadsheet_url', sheetInput.trim());
    flash('スプレッドシートURLを保存しました');
  }
  function flash(msg: string) {
    setSaved(msg);
    setTimeout(() => setSaved(''), 2000);
  }

  async function handleSync() {
    setSyncMsg('');
    const { ok, error } = await fetchRemoteSettings();
    setSyncMsg(ok ? '設定を同期しました' : `エラー: ${error}`);
    setTimeout(() => setSyncMsg(''), 3000);
  }

  function handleAddShop() {
    if (!newShopName.trim()) return;
    const shop: Shop = {
      store_id: `s${Date.now()}`,
      name: newShopName.trim(),
      floor: newShopFloor,
    };
    updateShop(shop);
    setNewShopName('');
  }

  function handleUpdateShop() {
    if (!editingShop) return;
    updateShop(editingShop);
    setEditingShop(null);
  }

  function handleAddPrize() {
    if (!newPrizeName.trim()) return;
    const newPrize: Prize = {
      prize_id: `p${Date.now()}`,
      name: newPrizeName.trim(),
      order: prizes.length + 1,
    };
    setPrizes([...prizes, newPrize]);
    setNewPrizeName('');
  }

  function handleDeletePrize(id: string) {
    setPrizes(prizes.filter((p) => p.prize_id !== id).map((p, i) => ({ ...p, order: i + 1 })));
  }

  function handleResetShops() {
    setShops(INITIAL_SHOPS);
    flash('店舗マスタをリセットしました');
  }

  const shopsByFloor = FLOORS.reduce((acc, floor) => {
    acc[floor] = shops.filter((s) => s.floor === floor);
    return acc;
  }, {} as Record<Floor, Shop[]>);

  return (
    <div className="p-4 space-y-4 pb-6">
      {saved && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-brand-600 text-white px-5 py-2 rounded-full text-sm shadow-lg">
          {saved}
        </div>
      )}

      {/* 端末情報 */}
      <Section title="端末情報">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">端末ID（自動）</label>
            <div className="text-xs text-gray-400 font-mono bg-gray-50 px-3 py-2 rounded-lg break-all">{deviceId}</div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">端末名（表示用）</label>
            <div className="flex gap-2">
              <input
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                placeholder="例: 1番レジ"
              />
              <button onClick={saveLabel} className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium">保存</button>
            </div>
          </div>
        </div>
      </Section>

      {/* GAS連携 */}
      <Section title="スプレッドシート連携（GAS）">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">GAS Web App URL</label>
            <textarea
              value={gasInput}
              onChange={(e) => setGasInput(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500 font-mono h-20"
              placeholder="https://script.google.com/macros/s/..."
              autoCapitalize="none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={saveGas} className="flex-1 bg-brand-600 text-white py-2 rounded-xl text-sm font-medium">URL保存</button>
            <button
              onClick={handleSync}
              disabled={isSyncing || !gasInput}
              className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              設定同期
            </button>
          </div>
          {syncMsg && <p className="text-sm text-brand-600 font-medium">{syncMsg}</p>}
          <div className="border-t border-gray-100 pt-3">
            <label className="text-xs text-gray-500 mb-1 block">スプレッドシートURL（リンクページ用）</label>
            <div className="flex gap-2">
              <input
                value={sheetInput}
                onChange={(e) => setSheetInput(e.target.value)}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500 font-mono"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                autoCapitalize="none"
              />
              <button onClick={saveSheet} className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium">保存</button>
            </div>
          </div>
        </div>
      </Section>

      {/* 賞マスタ */}
      <Section title="賞マスタ">
        <div className="space-y-2 mb-3">
          {prizes.sort((a, b) => a.order - b.order).map((p) => (
            <div key={p.prize_id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <span className="flex-1 text-sm font-medium">{p.name}</span>
              <button onClick={() => handleDeletePrize(p.prize_id)} className="text-gray-400 active:text-red-500 p-1">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newPrizeName}
            onChange={(e) => setNewPrizeName(e.target.value)}
            placeholder="新しい賞名"
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
          />
          <button onClick={handleAddPrize} className="bg-brand-600 text-white p-2 rounded-xl">
            <Plus size={20} />
          </button>
        </div>
      </Section>

      {/* 店舗マスタ */}
      <Section title="店舗マスタ">
        <div className="space-y-4">
          {FLOORS.map((floor) => (
            <div key={floor}>
              <div className="text-xs font-bold text-gray-500 mb-1">{floor}</div>
              <div className="space-y-1">
                {shopsByFloor[floor].map((shop) => (
                  <div key={shop.store_id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    {editingShop?.store_id === shop.store_id ? (
                      <>
                        <input
                          value={editingShop.name}
                          onChange={(e) => setEditingShop({ ...editingShop, name: e.target.value })}
                          className="flex-1 border border-brand-400 rounded-lg px-2 py-1 text-sm"
                        />
                        <select
                          value={editingShop.floor}
                          onChange={(e) => setEditingShop({ ...editingShop, floor: e.target.value as Floor })}
                          className="border border-gray-300 rounded-lg px-1 py-1 text-sm"
                        >
                          {FLOORS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <button onClick={handleUpdateShop} className="text-brand-600 text-xs font-bold px-2">保存</button>
                        <button onClick={() => setEditingShop(null)} className="text-gray-400 text-xs px-1">✕</button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm">{shop.name}</span>
                        <button onClick={() => setEditingShop(shop)} className="text-gray-400 text-xs px-2">編集</button>
                        <button onClick={() => deleteShop(shop.store_id)} className="text-gray-400 active:text-red-500 p-1">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {shopsByFloor[floor].length === 0 && (
                  <p className="text-xs text-gray-300 px-3">店舗なし</p>
                )}
              </div>
            </div>
          ))}

          {/* Add shop */}
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-bold text-gray-500">店舗を追加</p>
            <div className="flex gap-2">
              <input
                value={newShopName}
                onChange={(e) => setNewShopName(e.target.value)}
                placeholder="店舗名"
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              />
              <select
                value={newShopFloor}
                onChange={(e) => setNewShopFloor(e.target.value as Floor)}
                className="border border-gray-300 rounded-xl px-2 py-2 text-sm"
              >
                {FLOORS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <button onClick={handleAddShop} className="bg-brand-600 text-white p-2 rounded-xl">
                <Plus size={20} />
              </button>
            </div>
          </div>
          <button onClick={handleResetShops} className="text-xs text-gray-400 underline">
            初期データにリセット
          </button>
        </div>
      </Section>

      {/* データ管理 */}
      <Section title="データ管理（テスト用）">
        <div className="space-y-5">
          {deleteMsg && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium">
              {deleteMsg}
            </div>
          )}

          {/* 本日のデータを全て削除 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-700">本日のデータを全て削除</p>
                <p className="text-xs text-gray-400 mt-0.5">本日 {todayLogs.length}件のログ</p>
              </div>
              <button
                onClick={() => { setDeleteState('confirm_today'); }}
                disabled={todayLogs.length === 0 || isDeleting}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-200 active:bg-red-100 disabled:opacity-40"
              >
                全削除
              </button>
            </div>
            {deleteState === 'confirm_today' && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-red-700 font-bold">本当に削除しますか？</p>
                    <p className="text-xs text-red-600 mt-1">本日の全ログ {todayLogs.length}件を削除します。スプレッドシートからも即座に削除され、元に戻せません。</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteState('idle')}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 bg-white text-gray-600 rounded-xl text-sm font-medium border border-gray-300"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleDeleteToday}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                  >
                    {isDeleting ? '削除中...' : '削除する'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 時間を指定して削除 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">時間を指定して削除</p>
            {hoursWithData.length === 0 ? (
              <p className="text-xs text-gray-400">本日のログがありません</p>
            ) : (
              <>
                <div className="flex gap-2 mb-2">
                  <select
                    value={deleteHour}
                    onChange={(e) => { setDeleteHour(e.target.value); setDeleteState('idle'); }}
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                  >
                    <option value="">時間を選択</option>
                    {hoursWithData.map((h) => {
                      const cnt = todayLogs.filter((l) => getHourJST(l.timestamp) === h).length;
                      return (
                        <option key={h} value={h}>{h}:00〜{h}:59（{cnt}件）</option>
                      );
                    })}
                  </select>
                  <button
                    onClick={() => deleteHour && setDeleteState('confirm_hour')}
                    disabled={!deleteHour || isDeleting}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-200 active:bg-red-100 disabled:opacity-40"
                  >
                    削除
                  </button>
                </div>
                {deleteState === 'confirm_hour' && deleteHour && (
                  <div className="bg-red-50 border border-red-300 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-red-700 font-bold">本当に削除しますか？</p>
                        <p className="text-xs text-red-600 mt-1">
                          {deleteHour}:00〜{deleteHour}:59 の {todayLogs.filter((l) => getHourJST(l.timestamp) === deleteHour).length}件を削除します。スプレッドシートからも即座に削除され、元に戻せません。
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteState('idle')}
                        disabled={isDeleting}
                        className="flex-1 py-2.5 bg-white text-gray-600 rounded-xl text-sm font-medium border border-gray-300"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleDeleteHour}
                        disabled={isDeleting}
                        className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                      >
                        {isDeleting ? '削除中...' : '削除する'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Section>

      {/* ログアウト */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-4 bg-white rounded-2xl shadow-sm text-gray-500 font-medium border border-gray-200"
      >
        <LogOut size={18} />
        ログアウト
      </button>
    </div>
  );
}
