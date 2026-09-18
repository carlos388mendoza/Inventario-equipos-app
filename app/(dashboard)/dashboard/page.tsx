import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS, asUserRole } from "@/lib/db/enums";

export const dynamic = "force-dynamic";

export default async function DashboardHomePage() {
  const user = await requireUser();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Panel principal</h1>
      <p className="text-muted-foreground">
        Bienvenido/a, {user.name} ({ROLE_LABELS[asUserRole(user.role)]}). Este
        panel se ampliará en las siguientes fases.
      </p>
    </div>
  );
}