import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_ORGANIZATION,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Origen canónico. Sin esto, Next no puede resolver las URL relativas de
  // `alternates`, `openGraph.images` o `twitter.images` y avisa en el build.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | Grupo Comidas",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // La home redirige a /login o /dashboard según haya sesión, así que la URL
  // canónica de la raíz no debe ser indexable por sí sola: la página pública de
  // contenido es /inicio. `robots.ts` además excluye las áreas privadas.
  alternates: {
    canonical: "/",
  },
  keywords: [
    "inventario de equipos",
    "gestión de inventario",
    "solicitudes de equipo",
    "QR de seguridad",
    "impresión ZPL",
    "Zebra",
    "restaurantes",
    "Grupo Comidas",
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "es_MX",
    url: "/",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f5" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}