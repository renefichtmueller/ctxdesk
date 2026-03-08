import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const inboxCount = await prisma.inboxItem.count({
    where: { status: "unread" },
  });

  return (
    <div
      className="flex min-h-screen"
      style={{ background: "#0f172a" }}
    >
      {/* Top accent bar — subtle, just 1px */}
      <div
        className="fixed top-0 left-0 right-0 h-[1px] z-[60]"
        style={{
          background: "linear-gradient(90deg, transparent 0%, #6366f1 30%, #06b6d4 60%, #a855f7 85%, transparent 100%)",
        }}
      />

      <Sidebar inboxCount={inboxCount} />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-5 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
