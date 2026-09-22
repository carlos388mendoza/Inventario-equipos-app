import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { SettingsForm } from "@/components/settings/settings-form";

export const metadata: Metadata = {
  title: "Ajustes",
  description: "Preferencias de tema y densidad de tablas.",
};

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preferencias guardadas en este dispositivo.
          </p>
        </div>
        <SettingsForm userName={user.name} />
      </div>
    </div>
  );
}
