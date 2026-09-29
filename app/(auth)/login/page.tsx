import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";
import { GrupoComidasMark } from "@/components/brand/grupo-comidas-mark";

export const dynamic = "force-dynamic";

/**
 * El login es público pero no es contenido: se deja accesible a los crawlers
 * para que puedan alcanzar la landing, pero con `noindex` para que no ocupe
 * lugar en los resultados. La página pública indexable es /inicio.
 */
export const metadata: Metadata = {
  title: "Acceso",
  description: "Acceso privado al sistema de inventario de equipos.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/login" },
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 p-4">
      <div className="z-10 flex w-full max-w-md flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <GrupoComidasMark size={72} />
          <div>
            <h1 className="text-2xl font-bold">Inventario de Equipos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Grupo Comidas
            </p>
          </div>
        </div>
        <LoginForm />
        <Link
          href="/inicio"
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Conocer el sistema
        </Link>
      </div>
    </main>
  );
}