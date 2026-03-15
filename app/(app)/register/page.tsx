'use client';
import { useState, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Floor, Shop } from '@/lib/types';
import { CheckCircle, Trash2, Delete } from 'lucide-react';

const FLOORS: Floor[] = ['B1F', '1F', '2F', '3F'];

// ---- 電卓ポップアップ ----
function Calculator({
  onConfirm,
  onClose,
}: {
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');

  const numeric = parseInt(input) || 0;
  const slots = Math.floor(numeric / 1000);
  const rem = numeric % 1000;

  function press(key: string) {
    if (key === 'C') { setInput(''); return; }
    if (key === '⌫') { setInput((v) => v.slice(0, -1)); return; }
    if (key === '00') {
      setInput((v) => (v === '' ? '' : v + '00'));
      return;
    }
    // 上限: 9,999,999
    if (input.length >= 7) return;
    setInput((v) => (v === '0' ? key : v + key));
  }

  function confirm() {
    if (numeric > 0) onConfirm(String(numeric));
    onClose();
  }

  const rows = [
    ['7', '8', '9', '⌫'],
    ['4', '5', '6', 'C'],
    ['1', '2', '3', ''],
    ['0', '00', '', 'OK'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* 背景 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* 電卓本体 */}
      <div className="relative bg-white rounded-t-3xl shadow-2xl pb-safe">
        {/* 表示部 */}
        <div className="bg-brand-800 rounded-t-3xl px-6 pt-5 pb-4">
          <div className="text-right">
            <span className="text-5xl font-bold text-white tabular-nums tracking-tight">
              {input === '' ? '0' : parseInt(input).toLocaleString()}
            </span>
            <span className="text-2xl text-brand-300 ml-2">円</span>
          </div>
          <div className="mt-2 flex justify-end gap-3">
            {slots > 0 ? (
              <>
                <span className="bg-brand-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                  スロット {slots}回
                </span>
                {rem > 0 && (
                  <span className="text-brand-300 text-sm">余り {rem.toLocaleString()}円</span>
                )}
              </>
            ) : (
              <span className="text-brand-400 text-sm">1,000円以上で入力してください</span>
            )}
          </div>
        </div>

        {/* ボタン */}
        <div className="p-3 grid grid-cols-4 gap-2">
          {rows.map((row, ri) =>
            row.map((key, ci) => {
              if (key === '') return <div key={`${ri}-${ci}`} />;

              const isOK = key === 'OK';
              const isC = key === 'C';
              const isDel = key === '⌫';

              return (
                <button
                  key={`${ri}-${ci}`}
                  onClick={() => (isOK ? confirm() : press(key))}
                  className={`
                    h-16 rounded-2xl text-2xl font-bold flex items-center justify-center transition active:scale-95
                    ${isOK ? 'bg-brand-600 text-white shadow-md' : ''}
                    ${isC ? 'bg-orange-100 text-orange-600' : ''}
                    ${isDel ? 'bg-gray-100 text-gray-600' : ''}
                    ${!isOK && !isC && !isDel ? 'bg-gray-100 text-gray-800' : ''}
                  `}
                >
                  {isDel ? <Delete size={24} /> : key}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ---- 賞カウンター ----
function PrizeCounter({
  name,
  value,
  onChange,
  onReset,
}: {
  name: string;
  value: number;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  function adj(delta: number) {
    onChange(Math.max(0, value + delta));
  }

  const btnBase =
    'h-10 rounded-xl font-bold text-sm flex items-center justify-center transition active:scale-95 select-none';

  return (
    <div className="space-y-2 py-2 border-b border-gray-50 last:border-0">
      {/* 賞名 + リセット */}
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-gray-700">{name}</span>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-gray-300 active:text-red-400 px-2 py-1"
        >
          <Trash2 size={16} />
          <span className="text-xs">リセット</span>
        </button>
      </div>

      {/* カウンターボタン */}
      <div className="flex items-center gap-1.5">
        {/* マイナス系 */}
        <button onClick={() => adj(-10)} className={`${btnBase} w-12 bg-gray-100 text-gray-500`}>−10</button>
        <button onClick={() => adj(-5)}  className={`${btnBase} w-10 bg-gray-100 text-gray-500`}>−5</button>
        <button onClick={() => adj(-1)}  className={`${btnBase} w-10 bg-gray-100 text-gray-600 text-xl`}>−</button>

        {/* 数値 */}
        <span className="flex-1 text-center text-2xl font-bold tabular-nums">{value}</span>

        {/* プラス系 */}
        <button onClick={() => adj(1)}  className={`${btnBase} w-10 bg-brand-100 text-brand-700 text-xl`}>+</button>
        <button onClick={() => adj(5)}  className={`${btnBase} w-10 bg-brand-100 text-brand-600`}>+5</button>
        <button onClick={() => adj(10)} className={`${btnBase} w-12 bg-brand-100 text-brand-600`}>+10</button>
      </div>
    </div>
  );
}

// ---- メインページ ----
export default function RegisterPage() {
  const { shops, prizes, addLog } = useApp();

  const [activeFloor, setActiveFloor] = useState<Floor>('B1F');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [amount, setAmount] = useState('');
  const [prizeCounts, setPrizeCounts] = useState<Record<string, number>>({});
  const [showCalc, setShowCalc] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const slotCount = Math.floor((parseInt(amount) || 0) / 1000);
  const remainder = (parseInt(amount) || 0) % 1000;
  const totalPrizes = Object.values(prizeCounts).reduce((a, b) => a + b, 0);

  const shopsByFloor = FLOORS.reduce((acc, floor) => {
    acc[floor] = shops.filter((s) => s.floor === floor);
    return acc;
  }, {} as Record<Floor, Shop[]>);

  const handlePrizeChange = useCallback((id: string, val: number) => {
    setPrizeCounts((prev) => ({ ...prev, [id]: val }));
  }, []);

  const handlePrizeReset = useCallback((id: string) => {
    setPrizeCounts((prev) => ({ ...prev, [id]: 0 }));
  }, []);

  const canSubmit = selectedShop && slotCount > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    const prizeRecord: Record<string, number> = {};
    prizes.forEach((p) => { prizeRecord[p.prize_id] = prizeCounts[p.prize_id] || 0; });

    addLog({
      timestamp: new Date().toISOString(),
      store_id: selectedShop.store_id,
      store_name: selectedShop.name,
      floor: selectedShop.floor,
      receipt_amount: parseInt(amount),
      slot_count: slotCount,
      prizes: prizeRecord,
    });

    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setSelectedShop(null);
      setAmount('');
      setPrizeCounts({});
    }, 2000);
  }

  return (
    <div className="p-4 space-y-4">
      {/* 登録完了オーバーレイ */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50">
          <div className="bg-white rounded-3xl p-10 flex flex-col items-center shadow-2xl mx-6">
            <CheckCircle size={72} className="text-brand-600 mb-4" />
            <p className="text-3xl font-bold text-brand-700">登録しました！</p>
            {selectedShop && <p className="mt-2 text-gray-500">{selectedShop.name}</p>}
            <p className="text-gray-500">スロット {slotCount}回</p>
          </div>
        </div>
      )}

      {/* 電卓ポップアップ */}
      {showCalc && (
        <Calculator
          onConfirm={(v) => setAmount(v)}
          onClose={() => setShowCalc(false)}
        />
      )}

      {/* Step 1: 店舗選択 */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-bold text-gray-700 mb-3 text-base">
          ① 店舗を選択
          {selectedShop && (
            <span className="ml-2 text-brand-600 font-normal text-sm">
              → {selectedShop.name}（{selectedShop.floor}）
            </span>
          )}
        </h2>

        {/* 階数タブ */}
        <div className="flex gap-2 mb-3">
          {FLOORS.map((floor) => (
            <button
              key={floor}
              onClick={() => setActiveFloor(floor)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${
                activeFloor === floor
                  ? 'bg-brand-600 text-white shadow'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {floor}
            </button>
          ))}
        </div>

        {/* 店舗グリッド */}
        <div className="grid grid-cols-2 gap-2">
          {shopsByFloor[activeFloor].map((shop) => (
            <button
              key={shop.store_id}
              onClick={() => setSelectedShop(shop)}
              className={`px-3 py-3 rounded-xl text-sm font-medium text-left leading-snug transition ${
                selectedShop?.store_id === shop.store_id
                  ? 'bg-brand-600 text-white shadow'
                  : 'bg-gray-100 text-gray-700 active:bg-gray-200'
              }`}
            >
              {shop.name}
            </button>
          ))}
          {shopsByFloor[activeFloor].length === 0 && (
            <p className="col-span-2 text-center text-gray-400 py-4 text-sm">店舗がありません</p>
          )}
        </div>
      </div>

      {/* Step 2: レシート金額（電卓タップで入力） */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-bold text-gray-700 mb-3 text-base">② レシート金額</h2>
        <button
          onClick={() => setShowCalc(true)}
          className="w-full flex items-center justify-between border-b-2 border-brand-400 py-2 group"
        >
          <span className="text-gray-400 text-sm">タップして入力</span>
          <div className="flex items-center gap-2">
            <span className={`text-3xl font-bold tabular-nums ${amount ? 'text-gray-900' : 'text-gray-300'}`}>
              {amount ? parseInt(amount).toLocaleString() : '0'}
            </span>
            <span className="text-xl text-gray-500 font-medium">円</span>
          </div>
        </button>

        {slotCount > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="bg-brand-100 text-brand-700 font-bold px-3 py-1 rounded-full text-base">
              スロット {slotCount}回
            </span>
            {remainder > 0 && (
              <span className="text-gray-400 text-sm">（余り {remainder.toLocaleString()}円）</span>
            )}
          </div>
        )}
        {parseInt(amount) > 0 && slotCount === 0 && (
          <p className="mt-2 text-sm text-orange-500">1,000円以上のレシートが必要です</p>
        )}
      </div>

      {/* Step 3: 賞の結果 */}
      {slotCount > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="font-bold text-gray-700 mb-2 text-base">③ 賞の結果</h2>
          <div>
            {prizes
              .sort((a, b) => a.order - b.order)
              .map((prize) => (
                <PrizeCounter
                  key={prize.prize_id}
                  name={prize.name}
                  value={prizeCounts[prize.prize_id] || 0}
                  onChange={(v) => handlePrizeChange(prize.prize_id, v)}
                  onReset={() => handlePrizeReset(prize.prize_id)}
                />
              ))}
            <div className="pt-3 flex items-center justify-between">
              <span className="text-sm text-gray-400">ハズレ</span>
              <span className="text-2xl font-bold text-gray-300 tabular-nums">
                {Math.max(0, slotCount - totalPrizes)}回
              </span>
            </div>
            {totalPrizes > slotCount && (
              <p className="mt-1 text-sm text-orange-500">⚠️ 当選数がスロット回数を超えています</p>
            )}
          </div>
        </div>
      )}

      {/* 決定ボタン */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full py-5 rounded-2xl text-xl font-bold shadow-lg transition ${
          canSubmit
            ? 'bg-brand-600 text-white active:bg-brand-700'
            : 'bg-gray-200 text-gray-400'
        }`}
      >
        決　定
      </button>
      <div className="h-2" />
    </div>
  );
}
