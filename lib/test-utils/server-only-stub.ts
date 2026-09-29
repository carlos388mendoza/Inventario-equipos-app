/**
 * Stub de `server-only` para los tests.
 *
 * `server-only` existe para que un módulo que habla con la base de datos o con la
 * sesión falle al compilarse en un Client Component. En Vitest no existe el
 * límite RSC y el paquete real lanza, así que los tests que importan módulos de
 * servidor (acciones, `lib/auth/session`, `lib/equipment/scope`) apuntan aquí.
 *
 * No exporta nada: lo único que importa es que el import NO reviente.
 */
export {};
