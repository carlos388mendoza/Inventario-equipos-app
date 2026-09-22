import { requireUser } from "@/lib/auth/session";
import { asUserRole } from "@/lib/db/enums";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

export const dynamic = "force-dynamic";

/**
 * Layout del área autenticada. Comprueba sesión en servidor antes de
 * renderizar cualquier página del dashboard y muestra la navegación lateral
 * filtrada por rol.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <DashboardSidebar
        role={asUserRole(user.role)}
        name={user.name}
        email={user.email}
      />
      <div className="mx-auto w-full min-w-0 max-w-7xl flex-1">{children}</div>
    </div>
  );
}