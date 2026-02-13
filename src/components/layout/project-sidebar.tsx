'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { EchelonLogo } from '@/components/ui/logo';
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
    <aside className="w-[260px] bg-gradient-to-b from-[#001437] to-[#001a42] min-h-screen flex flex-col border-r border-white/5">
      <div className="p-5 pb-4">
        <div className="flex items-center gap-3">
          <EchelonLogo size={38} />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-white tracking-wide">ECHELON</h1>
            <p className="text-white/35 text-[9px] font-semibold uppercase tracking-[0.2em] truncate">
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

      <div className="px-5 mb-3 mt-1">
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <nav className="flex-1 px-3">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/20">
          Navigazione
        </p>
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
