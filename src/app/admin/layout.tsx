export const dynamic = 'force-dynamic';

import { AdminSidebar } from '@/components/layout/admin-sidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 content-bg p-8 overflow-auto">{children}</main>
    </div>
  );
}
