'use client';
import { useState, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Floor, Shop } from '@/lib/types';
import { CheckCircle } from 'lucide-react';

const FLOORS: Floor[] = ['B1F', '1F', '2F', '3F'];

function Counter({
  value,
  onChange,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-12 h-12 rounded-full bg-gray-100 text-2xl font-bold text-gray-600 flex items-center justify-center active:bg-gray-200 transition"
      >
        −
      </button>
      <span className="w-10 text-center text-2xl font-bold tabular-nums">{value}</span>
      <button
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        className="w-12 h-12 rounded-full bg-brand-100 text-2xl font-bold text-brand-700 flex items-center justify-center active:bg-brand-200 transition"
      >
        +
      </button>
    </div>
  );
}

export default function RegisterPage() {
  const { shops, prizes, addLog } = useApp();

  const [activeFloor, setActiveFloor] = useState<Floor>('B1F');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [amount, setAmount] = useState('');
  const [prizeCounts, setPrizeCounts] = useState<Record<string, number>>({});
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
      {/* Success overlay */}
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

      {/* Step 1: 店舗選択 */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-bold text-gray-700 mb-3 text-base">
          ① 店舗を選択
          {selectedShop && (
            <span className="ml-2 text-brand-600 font-normal">
              → {selectedShop.name}（{selectedShop.floor}）
            </span>
          )}
        </h2>

        {/* Floor tabs */}
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

        {/* Shop grid */}
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

      {/* Step 2: レシート金額 */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-bold text-gray-700 mb-3 text-base">② レシート金額</h2>
        <div className="flex items-center gap-3">
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(/^0+/, '');
              setAmount(v);
            }}
            placeholder="0"
            className="flex-1 text-3xl font-bold text-right border-b-2 border-brand-400 focus:outline-none focus:border-brand-600 py-2 bg-transparent tabular-nums"
          />
          <span className="text-xl text-gray-500 font-medium">円</span>
        </div>
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
          <h2 className="font-bold text-gray-700 mb-3 text-base">③ 賞の結果</h2>
          <div className="space-y-4">
            {prizes
              .sort((a, b) => a.order - b.order)
              .map((prize) => (
                <div key={prize.prize_id} className="flex items-center justify-between">
                  <span className="text-base font-medium text-gray-700 w-24">{prize.name}</span>
                  <Counter
                    value={prizeCounts[prize.prize_id] || 0}
                    onChange={(v) => handlePrizeChange(prize.prize_id, v)}
                  />
                </div>
              ))}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-400">ハズレ</span>
              <span className="text-lg font-bold text-gray-400 tabular-nums">
                {Math.max(0, slotCount - totalPrizes)}回
              </span>
            </div>
            {totalPrizes > slotCount && (
              <p className="text-sm text-orange-500">⚠️ 当選数がスロット回数を超えています</p>
            )}
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full py-5 rounded-2xl text-xl font-bold shadow-lg transition ${
          canSubmit
            ? 'bg-brand-600 text-white active:bg-brand-700 shadow-brand-200'
            : 'bg-gray-200 text-gray-400'
        }`}
      >
        決　定
      </button>

      <div className="h-2" />
    </div>
  );
}
