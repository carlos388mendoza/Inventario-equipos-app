"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { broadcastDataInvalidation, onDataInvalidation } from "./tab-sync";

/**
 * Ventana de agrupación para eventos recibidos.
 *
 * Si varias mutaciones ocurren en el mismo instante (o el usuario pulsa
 * "Guardar" dos veces), las otras pestañas reciben varios eventos seguidos.
 * Agruparlos evita una cadena de refrescos idénticos: solo se pide una vez el
 * RSC payload de la ruta. No es polling: solo reacciona a un evento.
 */
export const CROSS_TAB_REFRESH_COALESCE_MS = 120;

/**
 * Refresca esta pestaña cuando OTRAS pestañas del mismo navegador invalidan
 * sus datos.
 *
 * `router.refresh()` vuelve a pedir los Server Components de la ruta actual al
 * servidor, que ya tiene la caché invalidada por `revalidatePath` en la
 * mutación. Como la lectura se hace en el servidor con `resolveScope`, la
 * pestaña solo recibe lo que su propio usuario puede ver.
 *
 * Sin bucles: al recibir el evento solo se refresca, nunca se vuelve a
 * publicar. `router.refresh()` no ejecuta server actions, así que no puede
 * reencadenar la invalidación.
 */
export function useCrossTabRefresh(): void {
  const router = useRouter();

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = onDataInvalidation(() => {
      // DIAGNÓSTICO TEMPORAL
      console.log(
        "[TAB-SYNC] evento recibido, programando router.refresh",
        "yaProgramado=" + String(timer !== null)
      );
      if (timer !== null) {
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        // DIAGNÓSTICO TEMPORAL
        console.log("[TAB-SYNC] router.refresh");
        router.refresh();
      }, CROSS_TAB_REFRESH_COALESCE_MS);
    });

    return () => {
      unsubscribe();
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }, [router]);
}

export interface MutationSync {
  /**
   * Refresca la pestaña actual y avisa a las demás. Se llama SOLO tras una
   * mutación confirmada por el servidor (`result.ok`).
   */
  refreshAndBroadcast: () => void;
  /**
   * Igual, pero sin forzar el refresco propio: para los casos en que la propia
   * server action ya devuelve el RSC actualizado de la ruta actual (por
   * ejemplo al navegar con `router.push`).
   */
  broadcastOnly: () => void;
}

/**
 * Se usa en los manejadores de mutación, después del `toast.success`, nunca
 * antes: si la operación falló no se modificó nada y no hay nada que
 * sincronizar.
 */
export function useMutationSync(): MutationSync {
  const router = useRouter();

  const broadcastOnly = React.useCallback(() => {
    // DIAGNÓSTICO TEMPORAL
    console.log("[TAB-SYNC] broadcastOnly() invocado");
    broadcastDataInvalidation();
  }, []);

  const refreshAndBroadcast = React.useCallback(() => {
    // DIAGNÓSTICO TEMPORAL
    console.log("[TAB-SYNC] refreshAndBroadcast() invocado");
    router.refresh();
    broadcastDataInvalidation();
  }, [router]);

  return React.useMemo(
    () => ({ refreshAndBroadcast, broadcastOnly }),
    [refreshAndBroadcast, broadcastOnly],
  );
}
