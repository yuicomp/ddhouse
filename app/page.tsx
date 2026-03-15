'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const loggedIn = localStorage.getItem('ddh_logged_in') === '1';
    router.replace(loggedIn ? '/register' : '/login');
  }, [router]);
  return (
    <div className="flex h-screen items-center justify-center bg-brand-800">
      <div className="text-white text-xl">読み込み中...</div>
    </div>
  );
}
