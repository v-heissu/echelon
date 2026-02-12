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
  Shield,
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
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-teal flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white tracking-tight">ECHELON</h1>
            <p className="text-white/40 text-[10px] font-medium uppercase tracking-widest truncate">
              {projectName}
            </p>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="px-3 mb-1">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/30 hover:bg-white/5 hover:text-white/70 transition-all duration-200"
          >
            <ArrowLeft className="h-3 w-3" />
            Torna all&apos;admin
          </Link>
        </div>
      )}

      <div className="px-4 mb-2">
        <div className="h-px bg-white/10" />
      </div>

      <nav className="flex-1 px-3 mt-2">
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
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-all duration-200',
                isActive
                  ? 'bg-accent text-white shadow-lg shadow-accent/20'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/90'
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
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:bg-white/5 hover:text-white/80 w-full transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          Esci
        </button>
      </div>
    </aside>
  );
}
