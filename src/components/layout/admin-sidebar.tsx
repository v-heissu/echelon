'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
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
    <aside className="w-64 bg-primary min-h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white tracking-tight">ECHELON</h1>
        <p className="text-accent-light text-xs mt-1">Admin Panel</p>
      </div>

      <nav className="flex-1 px-3">
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
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium mb-1 transition-colors',
                isActive
                  ? 'bg-accent text-white'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-gray-300 hover:bg-white/10 hover:text-white w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Esci
        </button>
      </div>
    </aside>
  );
}
