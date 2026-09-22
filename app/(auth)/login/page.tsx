import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="z-10 flex w-full max-w-md flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-grupo-comidas.png"
              alt="Grupo Comidas"
              className="h-16 w-auto drop-shadow-sm"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Inventario de Equipos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Grupo Comidas
            </p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}