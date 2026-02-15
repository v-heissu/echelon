export const dynamic = 'force-dynamic';

import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { Footer } from '@/components/layout/footer';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 content-bg overflow-auto flex flex-col">
        <main className="flex-1 p-8">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
