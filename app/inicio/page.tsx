import type { Metadata } from "next";
import Link from "next/link";
import { GrupoComidasMark } from "@/components/brand/grupo-comidas-mark";
import { Badge } from "@/components/ui/badge";
import {
  PUBLIC_LANDING_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_ORGANIZATION,
  SITE_TITLE,
} from "@/lib/site";

/**
 * Landing pública del sistema.
 *
 * Es la única página de contenido indexable del sitio, y por diseño es
 * estática: no consulta la base de datos, no lee la sesión y no menciona rutas
 * del panel. Solo enlaza a /login, que es la entrada real para el personal
 * autorizado.
 */
export const metadata: Metadata = {
  // `absolute` ignora la plantilla "%s | Grupo Comidas" del layout: para la
  // página pública el título completo es mejor que "Inicio | Grupo Comidas",
  // que es lo que se comparte al publicar el enlace.
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: PUBLIC_LANDING_PATH,
  },
  // Open Graph y Twitter se declaran completos a propósito. La fusión de
  // metadata de Next es superficial: un `openGraph` parcial en la página
  // sustituye al del layout y se perderían `type`, `siteName`, `locale` e
  // `images`, que aquí son justamente los que hacen la vista previa enriquecida.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "es_MX",
    url: PUBLIC_LANDING_PATH,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/logo-grupo-comidas.png",
        width: 1399,
        height: 501,
        alt: `${SITE_ORGANIZATION} — ${SITE_NAME}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/logo-grupo-comidas.png"],
  },
};

const MODULES = [
  {
    title: "Inventario de equipos",
    description:
      "Registro por equipo con código de activo, tipo, marca, modelo, estado y " +
      "restaurante asignado. Incluye búsqueda, filtros y ficha individual.",
  },
  {
    title: "Solicitudes de compra y reemplazo",
    description:
      "Las unidades solicitan equipos; IT y administración revisan, aprueban o " +
      "rechazan. Cada cambio de estado queda en el historial de la solicitud.",
  },
  {
    title: "Movimientos entre restaurantes",
    description:
      "Traslado, jalado, préstamo, devolución, copia y sustitución, con libro de " +
      "movimientos auditable y aviso de qué unidad es dueña del equipo.",
  },
  {
    title: "Etiquetas de seguridad y QR",
    description:
      "Etiqueta por equipo con código QR que apunta a una ficha pública y " +
      "minimalista, e impresión directa en Zebra mediante Browser Print y ZPL.",
  },
  {
    title: "Documentos de inventario de origen",
    description:
      "Conserva el detalle de los Excel entregados: equipos individuales y " +
      "agregados por rubro, con su documento y cantidad original.",
  },
  {
    title: "Estadísticas y asistente de IA",
    description:
      "Indicadores de inventario y solicitudes, y un asistente que responde " +
      "sobre datos reales mediante consultas predefinidas, sin ejecutar SQL.",
  },
];

const PRINCIPLES = [
  {
    title: "La autorización se valida en el servidor",
    description:
      "Cada página y cada acción revalidan sesión y rol. Ocultar un botón en la " +
      "interfaz nunca es lo que protege un dato.",
  },
  {
    title: "El QR no expone información sensible",
    description:
      "El código contiene un token opaco, no el identificador del equipo. La " +
      "pública muestra tipo, estado y restaurante, nunca número de serie ni notas.",
  },
  {
    title: "El historial no se reescribe",
    description:
      "Movimientos e historial sobreviven a la eliminación de un equipo, para " +
      "poder auditar qué pasó y cuándo.",
  },
];

export default function InicioPage() {
  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="flex flex-col items-center gap-6 text-center">
          <GrupoComidasMark size={88} />
          <div className="space-y-3">
            <Badge variant="secondary">{SITE_ORGANIZATION}</Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {SITE_NAME}
            </h1>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              {SITE_DESCRIPTION}
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Acceder al sistema
          </Link>
          <p className="text-xs text-muted-foreground">
            El acceso es por cuenta autorizada. No hay registro público.
          </p>
        </header>

        <section className="mt-16" aria-labelledby="modulos">
          <h2 id="modulos" className="text-2xl font-semibold tracking-tight">
            Qué resuelve
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Un solo lugar para saber qué equipo existe, dónde está, quién lo
            pidió y qué se imprimió como etiqueta.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((module) => (
              <li
                key={module.title}
                className="rounded-lg border bg-background p-5"
              >
                <h3 className="font-semibold">{module.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {module.description}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16" aria-labelledby="principios">
          <h2 id="principios" className="text-2xl font-semibold tracking-tight">
            Cómo está construido
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {PRINCIPLES.map((principle) => (
              <li
                key={principle.title}
                className="rounded-lg border bg-background p-5"
              >
                <h3 className="font-semibold">{principle.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {principle.description}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16" aria-labelledby="stack">
          <h2 id="stack" className="text-2xl font-semibold tracking-tight">
            Con qué está hecho
          </h2>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              ["Next.js App Router", "React con Server Components"],
              ["TypeScript estricto", "y ESLint en cada entrega"],
              ["Tailwind CSS", "componentes con Radix UI"],
              ["Better Auth", "sesiones y roles"],
              ["Drizzle ORM", "sobre Turso (libSQL)"],
              ["Zebra Browser Print", "impresión ZPL de etiquetas"],
            ].map(([term, detail]) => (
              <div key={term} className="rounded-lg border bg-background p-4">
                <dt className="font-medium">{term}</dt>
                <dd className="text-sm text-muted-foreground">{detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="mt-16 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>
            {SITE_ORGANIZATION} · {SITE_TITLE}
          </p>
          <p className="mt-1 text-xs">
            Aplicación de uso interno. La información mostrada corresponde a
            unidades del grupo.
          </p>
        </footer>
      </div>
    </main>
  );
}
