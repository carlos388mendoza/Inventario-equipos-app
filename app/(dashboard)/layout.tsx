import { requireRole } from "@/lib/auth/session";
import { ROLES } from "@/lib/db/enums";

export const dynamic = "force-dynamic";

/**
 * Layout del área autenticada. Comprueba sesión y cuenta activa en servidor
 * antes de renderizar cualquier página del dashboard.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(ROLES.ADMIN, ROLES.IT_MANAGER, ROLES.RESTAURANT_USER);
  return <div>{children}</div>;
}