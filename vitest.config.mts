import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Solo configura Vitest. Next.js no lee este archivo.
 *
 * El alias `@/` replica el de `tsconfig.json` para que los tests puedan importar
 * módulos de producción tal cual (`@/lib/db/schema`), igual que hace la app. Se
 * declara a mano en lugar de añadir `vite-tsconfig-paths` para no meter una
 * dependencia nueva.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `server-only` lanza siempre fuera de RSC. Los tests que importan
      // acciones o `lib/auth/session` necesitan el módulo, no su guardia.
      "server-only": fileURLToPath(
        new URL("./lib/test-utils/server-only-stub.ts", import.meta.url)
      ),
    },
  },
});
