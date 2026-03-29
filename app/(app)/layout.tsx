'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AppProvider } from '@/contexts/AppContext';
import { clearSession } from '@/lib/storage';
import { ClipboardList, BarChart2, Settings, LogOut, Link2 } from 'lucide-react';

function LogoutButton() {
  const router = useRouter();
  const handleLogout = () => {
    clearSession();
    router.replace('/login');
  };
  return (
    <button onClick={handleLogout} className="flex items-center gap-1 text-brand-200 hover:text-white transition-colors p-1">
      <LogOut size={20} strokeWidth={1.8} />
    </button>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(localStorage.getItem('ddh_user_role') === 'kanrisha');
  }, [pathname]); // pathnameが変わるたびに再チェック

  const tabs = [
    { href: '/register', label: '登録', Icon: ClipboardList },
    { href: '/stats', label: '集計', Icon: BarChart2 },
    { href: '/links', label: 'リンク', Icon: Link2 },
    ...(isAdmin ? [{ href: '/settings', label: '設定', Icon: Settings }] : []),
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-brand-100 safe-bottom z-50">
      <div className="flex">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                active ? 'text-brand-600' : 'text-gray-400'
              }`}
            >
              <Icon size={26} strokeWidth={active ? 2.2 : 1.8} />
              <span className={`text-xs font-medium ${active ? 'text-brand-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="h-safe" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
    </nav>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (localStorage.getItem('ddh_logged_in') !== '1') {
      router.replace('/login');
      return;
    }
    // 設定ページは管理者のみ
    if (pathname === '/settings' && localStorage.getItem('ddh_user_role') !== 'kanrisha') {
      router.replace('/register');
    }
  }, [router, pathname]);
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AuthGuard>
        <div className="flex flex-col h-screen bg-gray-50">
          {/* Header */}
          <header className="bg-brand-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-md">
            <div>
              <div className="font-bold text-lg tracking-wide leading-tight">D.D.HOUSE</div>
              <div className="text-brand-200 text-xs leading-tight">スロット集計</div>
            </div>
            <LogoutButton />
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto pb-20 scroll-area">
            {children}
          </main>

          <BottomNav />
        </div>
      </AuthGuard>
    </AppProvider>
  );
}
