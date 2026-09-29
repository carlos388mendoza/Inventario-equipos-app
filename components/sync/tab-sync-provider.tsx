"use client";

import { useCrossTabRefresh } from "@/lib/sync/use-tab-sync";

/**
 * Punto único de escucha de invalidaciones entre pestañas.
 *
 * Se monta UNA vez en el layout del panel. Todas las vistas que dependen de
 * datos mutables (panel, inventario, solicitudes, estadísticas, etiquetas,
 * restaurantes, usuarios) heredan la sincronización sin repetir listeners en
 * cada página.
 *
 * No renderiza nada: solo gestiona el ciclo de vida del listener.
 */
export function TabSyncProvider() {
  // DIAGNÓSTICO TEMPORAL
  console.log("[TAB-SYNC] provider mounted", "isClient=", typeof window !== "undefined");

  useCrossTabRefresh();
  return null;
}
