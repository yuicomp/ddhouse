'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getGasUrl, setLoggedIn } from '@/lib/storage';
import { authenticate } from '@/lib/gas';

export default function LoginPage() {
  const router = useRouter();
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!id || !pass) { setError('IDとパスワードを入力してください'); return; }
    setLoading(true);
    setError('');
    try {
      const gasUrl = getGasUrl();
      if (!gasUrl) {
        // GAS未設定時はオフラインモード（初回セットアップ用）
        setError('GAS URLが設定されていません。設定後に再試行してください。\n（初回のみ：IDを"ipad1"、パスを"ddhouse"で仮ログインできます）');
        // fallback: hardcoded initial credentials
        if (id === 'ipad1' && pass === 'ddhouse') {
          setLoggedIn();
          router.replace('/register');
        }
        return;
      }
      const ok = await authenticate(gasUrl, id, pass);
      if (ok) {
        setLoggedIn();
        router.replace('/register');
      } else {
        setError('IDまたはパスワードが違います');
      }
    } catch {
      setError('接続エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-brand-900 to-brand-700 px-6">
      {/* Logo area */}
      <div className="mb-10 text-center">
        <div className="text-4xl font-bold text-white tracking-widest mb-1">D.D.HOUSE</div>
        <div className="text-brand-200 text-lg tracking-wide">スロット集計システム</div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <h2 className="text-center text-brand-700 font-bold text-xl mb-6">ログイン</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">スタッフID</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              placeholder="例: ipad1"
              autoComplete="username"
              autoCapitalize="none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">パスワード</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              placeholder="パスワード"
              autoComplete="current-password"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-700 text-sm whitespace-pre-line">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="mt-6 w-full bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-lg py-4 rounded-xl shadow transition disabled:opacity-60"
        >
          {loading ? 'ログイン中...' : 'ログイン'}
        </button>
      </div>

      <p className="mt-6 text-brand-200 text-xs text-center">
        GAS URLの設定は<br />ログイン後の「設定」タブから行えます
      </p>
    </div>
  );
}
