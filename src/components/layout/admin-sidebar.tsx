'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { EchelonLogo } from '@/components/ui/logo';
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Activity,
  LogOut,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/projects', label: 'Progetti', icon: FolderOpen },
  { href: '/admin/users', label: 'Utenti', icon: Users },
  { href: '/admin/jobs', label: 'Job Monitor', icon: Activity },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-[260px] bg-gradient-to-b from-[#001437] to-[#001a42] min-h-screen flex flex-col border-r border-white/5">
      <div className="p-5 pb-4">
        <div className="flex items-center gap-3">
          <EchelonLogo size={38} />
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">ECHELON</h1>
            <p className="text-white/35 text-[9px] font-semibold uppercase tracking-[0.2em]">Admin Panel</p>
          </div>
        </div>
      </div>

      <div className="px-5 mb-3 mt-1">
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <nav className="flex-1 px-3">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/20">
          Gestione
        </p>
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium mb-0.5 transition-all duration-200',
                isActive
                  ? 'bg-accent/90 text-white shadow-lg shadow-accent/25 backdrop-blur-sm'
                  : 'text-white/45 hover:bg-white/[0.06] hover:text-white/90'
              )}
            >
              <item.icon className={cn('h-[18px] w-[18px]', isActive ? 'text-white' : 'text-white/40')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 mt-auto">
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-3" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-white/35 hover:bg-white/[0.06] hover:text-white/80 w-full transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          Esci
        </button>
      </div>
    </aside>
  );
}
