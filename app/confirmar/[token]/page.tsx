import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  equipmentRequests,
  equipmentTypes,
  requestConfirmationTokens,
  restaurants,
} from "@/lib/db/schema";
import { formatDestinationArea } from "@/lib/db/enums";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmationForm } from "./confirmation-form";

/**
 * Página pública de confirmación de instalación (issue #13).
 *
 * Accesible SOLO con el token opaco del correo de seguimiento: sin token no se
 * revela ninguna solicitud. Muestra el resumen de la solicitud correspondiente
 * y permite confirmar la instalación (o indicar que aún no ocurrió). El token
 * es de un solo uso.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirmar instalación",
  robots: { index: false, follow: false },
};

export default async function ConfirmInstallationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const rows = await db
    .select({
      usedAt: requestConfirmationTokens.usedAt,
      expiresAt: requestConfirmationTokens.expiresAt,
      purpose: requestConfirmationTokens.purpose,
      restaurantName: restaurants.name,
      restaurantCode: restaurants.code,
      equipmentTypeName: equipmentTypes.name,
      destinationArea: equipmentRequests.destinationArea,
    })
    .from(requestConfirmationTokens)
    .innerJoin(
      equipmentRequests,
      eq(requestConfirmationTokens.requestId, equipmentRequests.id)
    )
    .innerJoin(
      restaurants,
      eq(equipmentRequests.restaurantId, restaurants.id)
    )
    .innerJoin(
      equipmentTypes,
      eq(equipmentRequests.equipmentTypeId, equipmentTypes.id)
    )
    .where(eq(requestConfirmationTokens.token, token))
    .limit(1);

  if (rows.length === 0 || rows[0].purpose !== "INSTALLATION_FOLLOWUP") {
    notFound();
  }
  const row = rows[0];

  const used = row.usedAt !== null;
  // Fecha de render del server component: la caducidad se evalúa en el momento
  // de servir el HTML; no es un estado que cambie de forma impura en el cliente.
  // eslint-disable-next-line react-hooks/purity
  const expired = row.expiresAt.getTime() < Date.now();
  const invalid = used || expired;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Confirmación de instalación</CardTitle>
          <CardDescription>
            {row.restaurantName} ({row.restaurantCode})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {invalid ? (
            <p className="rounded-md bg-muted/50 p-4 text-center text-sm text-muted-foreground">
              {used
                ? "Este enlace ya fue utilizado. Si necesitas cambiar la información, contacta al administrador."
                : "Este enlace ha caducado. Solicita uno nuevo al administrador del sistema."}
            </p>
          ) : (
            <>
              <div className="rounded-md bg-primary/5 p-4 text-center">
                <p className="text-lg font-semibold">{row.equipmentTypeName}</p>
                {row.destinationArea && (
                  <p className="text-sm text-muted-foreground">
                    Área de destino: {formatDestinationArea(row.destinationArea)}
                  </p>
                )}
              </div>
              <ConfirmationForm token={token} />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}