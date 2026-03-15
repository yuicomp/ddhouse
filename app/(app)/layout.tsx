'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AppProvider } from '@/contexts/AppContext';
import { ClipboardList, BarChart2, Settings } from 'lucide-react';

function BottomNav() {
  const pathname = usePathname();
  const tabs = [
    { href: '/register', label: '登録', Icon: ClipboardList },
    { href: '/stats', label: '集計', Icon: BarChart2 },
    { href: '/settings', label: '設定', Icon: Settings },
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
  useEffect(() => {
    if (localStorage.getItem('ddh_logged_in') !== '1') {
      router.replace('/login');
    }
  }, [router]);
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
