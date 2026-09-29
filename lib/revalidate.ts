import { revalidatePath } from "next/cache";

/**
 * Invalidación de vistas del panel.
 *
 * Las páginas del panel comparten tablas: el resumen de `/dashboard` lee
 * `equipment`, `restaurants`, `securityLabels` y `equipment_requests`, y
 * `/statistics` lee equipos, tipos y solicitudes. Antes cada server action
 * revalidaba solo su propia ruta, así que crear o editar un equipo dejaba
 * contadores y listas desactualizadas en el resto del panel.
 *
 * Por eso cada helper declara el conjunto COMPLETO de rutas afectadas por un
 * tipo de escritura. Todas estas páginas son dinámicas (`force-dynamic`), así
 * que revalidar descarta la entrada del router cache y la siguiente lectura
 * vuelve a consultar la base de datos. Esto no omite la autorización: los
 * Server Components siguen aplicando `resolveScope` en cada consulta.
 *
 * Añadir una vista nueva que dependa de estos datos significa añadir su ruta
 * aquí; no extender la invalidación a rutas que no la necesitan.
 */

/** Equipos: panel, inventario, estadísticas y detalle del equipo. */
export function revalidateEquipmentViews(equipmentId?: string): void {
  revalidatePath("/equipment");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/statistics");
  if (equipmentId) {
    revalidatePath(`/equipment/${equipmentId}`);
  }
}

/**
 * Tipos de equipo: aparecen en los filtros de `/equipment` y `/inventory`, y
 * en el desglose de `/statistics` y `/dashboard` por tipo.
 */
export function revalidateEquipmentTypeViews(): void {
  revalidatePath("/equipment-types");
  revalidatePath("/equipment");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/statistics");
}

/**
 * Solicitudes: el panel y las estadísticas cuentan pendientes y decididas, y
 * una compra/reemplazo puede cambiar el estado del equipo referenciado.
 */
export function revalidateRequestViews(): void {
  revalidatePath("/requests");
  revalidatePath("/my-requests");
  revalidatePath("/dashboard");
  revalidatePath("/statistics");
}

/**
 * Etiquetas: el panel cuenta las etiquetas emitidas y `/equipment` muestra el
 * estado de seguridad del equipo.
 */
export function revalidateLabelViews(equipmentId?: string): void {
  revalidatePath("/labels");
  revalidatePath("/dashboard");
  revalidatePath("/equipment");
  if (equipmentId) {
    revalidatePath(`/equipment/${equipmentId}`);
  }
}

/**
 * Restaurantes: el panel lista unidades y el resumen por unidad, y equipo e
 * inventario se filtran e identifican por restaurante.
 */
export function revalidateRestaurantViews(): void {
  revalidatePath("/restaurants");
  revalidatePath("/equipment");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

/** Usuarios: la gestión de usuarios no alimenta contadores del panel. */
export function revalidateUserViews(): void {
  revalidatePath("/users");
}

/**
 * Movimientos de inventario.
 *
 * Un movimiento cambia `equipment.restaurantId`, así que arrastra las mismas
 * vistas que un traslado hecho a mano desde el formulario. `/movements` es la
 * vista nueva que lee el libro y hay que añadirla aquí: es exactamente el caso
 * que documenta el comentario de este archivo ("añadir una vista nueva que
 * dependa de estos datos significa añadir su ruta").
 *
 * No revalida `/labels`: ni la etiqueta ni su token cambian al mover un equipo.
 * La etiqueta pertenece al equipo, no a la unidad donde está.
 */
export function revalidateMovementViews(equipmentIds?: string[]): void {
  revalidatePath("/movements");
  if (equipmentIds && equipmentIds.length > 0) {
    // Varias fichas pueden haber cambiado en un lote; se revalida una por una
    // en lugar de ampliar la invalidación a rutas que no lo necesitan.
    for (const equipmentId of equipmentIds) {
      revalidateEquipmentViews(equipmentId);
    }
    return;
  }
  revalidateEquipmentViews();
}
