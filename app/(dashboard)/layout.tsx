import { requireUser } from "@/lib/auth/session";
import { asUserRole } from "@/lib/db/enums";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { CommandPaletteProvider } from "@/components/dashboard/command-palette-provider";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopBar } from "@/components/dashboard/top-bar";
import { TabSyncProvider } from "@/components/sync/tab-sync-provider";

export const dynamic = "force-dynamic";

/**
 * Layout del área autenticada. Comprueba sesión en servidor antes de
 * renderizar cualquier página del dashboard y muestra la navegación lateral
 * filtrada por rol.
 *
 * Monta además `TabSyncProvider`, que mantiene esta pestaña al día cuando
 * otra pestaña del mismo navegador modifica datos.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const role = asUserRole(user.role);
  return (
    // `lg:flex-row` mantiene el sidebar fijo de escritorio; por debajo de `lg`
    // la columna superior la ocupa el encabezado con el botón de menú. `min-w-0`
    // en el contenido es lo que evita que una tabla ancha desborde horizontalmente
    // en móvil en vez de desplazarse dentro de su contenedor.
    //
    // `CommandPaletteProvider` comparte el estado de la paleta (#19) entre el
    // encabezado y el propio diálogo, para que los accesos de escritorio y de
    // móvil abran exactamente la misma búsqueda.
    <CommandPaletteProvider>
      <div className="flex min-h-screen flex-col bg-background lg:flex-row">
        <DashboardSidebar
          role={role}
          name={user.name}
          email={user.email}
        />
        {/* Paleta de comandos (#19): Cmd/Ctrl+K y los accesos del encabezado. */}
        <CommandPalette role={role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardTopBar
            role={role}
            name={user.name}
            email={user.email}
          />
          <div className="mx-auto w-full min-w-0 max-w-7xl flex-1">
            <TabSyncProvider />
            {children}
          </div>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}