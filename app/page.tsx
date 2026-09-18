import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-bold tracking-tight">
        Inventario de Equipos — Grupo Comidas
      </h1>
      <p className="max-w-md text-muted-foreground">
        Sistema de gestión de inventario, solicitudes y etiquetas QR de equipos.
        El proyecto está en construcción por fases.
      </p>
      <Link
        href="/login"
        className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
      >
        Ir al inicio de sesión
      </Link>
    </main>
  );
}