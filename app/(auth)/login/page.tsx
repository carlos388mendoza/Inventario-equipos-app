import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-grupo-comidas.png"
          alt="Grupo Comidas"
          className="h-14 w-auto"
        />
        <LoginForm />
      </div>
    </main>
  );
}