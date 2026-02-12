'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  List,
  TrendingUp,
  Tag,
  Building2,
  Download,
  LogOut,
  ArrowLeft,
} from 'lucide-react';

interface ProjectSidebarProps {
  slug: string;
  projectName: string;
  isAdmin: boolean;
}

export function ProjectSidebar({ slug, projectName, isAdmin }: ProjectSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const basePath = `/project/${slug}`;
  const navItems = [
    { href: basePath, label: 'Dashboard', icon: LayoutDashboard },
    { href: `${basePath}/results`, label: 'Risultati', icon: List },
    { href: `${basePath}/trends`, label: 'Trend', icon: TrendingUp },
    { href: `${basePath}/tags`, label: 'Tag Cloud', icon: Tag },
    { href: `${basePath}/competitors`, label: 'Competitor', icon: Building2 },
    { href: `${basePath}/export`, label: 'Export', icon: Download },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-64 bg-primary min-h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white tracking-tight">ECHELON</h1>
        <p className="text-accent-light text-xs mt-1 truncate">{projectName}</p>
      </div>

      {isAdmin && (
        <div className="px-3 mb-2">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Torna all&apos;admin
          </Link>
        </div>
      )}

      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const isActive =
            item.href === basePath
              ? pathname === basePath
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
