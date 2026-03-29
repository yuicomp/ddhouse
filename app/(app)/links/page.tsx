'use client';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, AlertTriangle, ExternalLink } from 'lucide-react';

const REGISTER_URL = 'https://ddhouse-flax.vercel.app/register';

export default function LinksPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setIsAdmin(localStorage.getItem('ddh_user_role') === 'kanrisha');
    setSpreadsheetUrl(localStorage.getItem('ddh_spreadsheet_url') || '');
  }, []);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* 登録画面QRコード */}
      <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-4">
        <h3 className="font-bold text-gray-700 text-base">登録画面（他の端末で開く）</h3>
        <QRCodeSVG value={REGISTER_URL} size={200} />
        <p className="text-xs text-gray-400 text-center break-all">{REGISTER_URL}</p>
        <button
          onClick={() => copy(REGISTER_URL, 'register')}
          className="flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-700 rounded-xl text-sm font-medium active:bg-brand-100 w-full justify-center"
        >
          {copied === 'register' ? <Check size={16} /> : <Copy size={16} />}
          {copied === 'register' ? 'コピーしました' : 'URLをクリップボードにコピー'}
        </button>
      </div>

      {/* スプレッドシートリンク（管理者のみ） */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-700">スプレッドシート</h3>

          <div className="flex items-start gap-2 bg-yellow-50 rounded-xl p-3">
            <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-700 leading-relaxed">
              スプシのデータを直接編集するとアプリのデータが変更されます。<br />
              誤って削除・変更すると元に戻せません。取り扱いには十分注意してください。
            </p>
          </div>

          {spreadsheetUrl ? (
            <>
              <button
                onClick={() => copy(spreadsheetUrl, 'sheet')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-50 text-brand-700 rounded-xl text-sm font-medium active:bg-brand-100"
              >
                {copied === 'sheet' ? <Check size={16} /> : <Copy size={16} />}
                {copied === 'sheet' ? 'コピーしました' : 'URLをクリップボードにコピー'}
              </button>
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 text-xs text-brand-500 underline break-all"
              >
                <ExternalLink size={12} />
                スプレッドシートを開く
              </a>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">
              設定画面でスプレッドシートURLを登録してください
            </p>
          )}
        </div>
      )}
    </div>
  );
}
