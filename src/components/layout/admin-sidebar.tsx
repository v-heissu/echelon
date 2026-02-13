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
    <aside className="w-[264px] sidebar-mesh min-h-screen flex flex-col">
      {/* Logo area */}
      <div className="p-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
            <EchelonLogo size={28} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-white tracking-wider">ECHELON</h1>
            <p className="text-white/30 text-[10px] font-medium mt-0.5">Admin Panel</p>
          </div>
        </div>
      </div>

      <div className="px-6 mb-4 mt-1">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      </div>

      <nav className="flex-1 px-4">
        <p className="px-3 mb-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/20">
          Gestione
        </p>
        <div className="space-y-0.5">
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
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group',
                  isActive
                    ? 'bg-white/[0.12] text-white shadow-glow backdrop-blur-sm ring-1 ring-white/[0.08]'
                    : 'text-white/40 hover:bg-white/[0.06] hover:text-white/80'
                )}
              >
                <item.icon className={cn(
                  'h-[17px] w-[17px] transition-colors',
                  isActive ? 'text-accent-light' : 'text-white/30 group-hover:text-white/60'
                )} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="p-4 mt-auto">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-3" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-white/30 hover:bg-white/[0.06] hover:text-white/70 w-full transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          Esci
        </button>
      </div>
    </aside>
  );
}
