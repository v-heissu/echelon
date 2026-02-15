'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  List,
  TrendingUp,
  Tag,
  Users,
  Download,
  History,
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
    { href: `${basePath}/tags`, label: 'Tag Intelligence', icon: Tag },
    { href: `${basePath}/entities`, label: 'Entità', icon: Users },
    { href: `${basePath}/scans`, label: 'Scansioni', icon: History },
    { href: `${basePath}/export`, label: 'Export', icon: Download },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-[264px] sidebar-mesh min-h-screen flex flex-col">
      {/* Top: admin link + nav */}
      {isAdmin && (
        <div className="px-4 pt-5 mb-1">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-all duration-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Admin Panel
          </Link>
        </div>
      )}

      <div className={cn('px-6 mb-4', isAdmin ? 'mt-1' : 'mt-6')}>
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      </div>

      <nav className="flex-1 px-4">
        <p className="px-3 mb-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/20">
          Menu
        </p>
        <div className="space-y-0.5">
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

      {/* Bottom: brand + logout */}
      <div className="p-4 mt-auto">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-4" />

        {/* Brand block */}
        <div className="flex items-center gap-3 px-2 mb-4">
          <Image
            src="/logo.png"
            alt="Echelon"
            width={44}
            height={44}
            className="rounded-xl shadow-lg shadow-black/30"
          />
          <div className="min-w-0">
            <h1
              className="text-[16px] font-bold text-white tracking-[0.12em]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              ECHELON
            </h1>
            <p className="text-white/30 text-[10px] font-medium truncate mt-0.5">
              {projectName}
            </p>
          </div>
        </div>

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
