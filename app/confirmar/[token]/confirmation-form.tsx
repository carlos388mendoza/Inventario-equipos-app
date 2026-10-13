"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { submitInstallationConfirmation } from "./actions";
import { Button } from "@/components/ui/button";

export function ConfirmationForm({ token }: { token: string }) {
  const [submitting, startSubmit] = useTransition();
  const [result, setResult] = React.useState<string | null>(null);

  function submit(confirmed: boolean) {
    startSubmit(async () => {
      const res = await submitInstallationConfirmation({ token, confirmed });
      if (!res.ok || !("message" in res)) {
        toast.error(
          !res.ok
            ? res.error ?? "No se pudo procesar la confirmación."
            : "No se pudo procesar la confirmación."
        );
        return;
      }
      setResult(res.message);
      toast.success(res.message);
    });
  }

  if (result) {
    return (
      <div className="rounded-md bg-primary/5 p-4 text-center">
        <p className="font-medium">{result}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Puedes cerrar esta ventana.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        ¿Ya se instaló el equipo solicitado en la unidad?
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="flex-1"
          disabled={submitting}
          onClick={() => submit(true)}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Sí, ya se instaló
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          disabled={submitting}
          onClick={() => submit(false)}
        >
          <XCircle className="mr-2 h-4 w-4" />
          Aún no se ha instalado
        </Button>
      </div>
    </div>
  );
}