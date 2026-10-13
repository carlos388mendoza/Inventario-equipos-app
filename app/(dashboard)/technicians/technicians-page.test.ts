import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLES } from "@/lib/db/enums";

/**
 * Puerta de la pantalla de técnicos (issue #16).
 *
 * La página existe para que el administrador y el jefe de técnicos gestionen
 * las asignaciones. El resto de roles (incluido IT_MANAGER) debe ser rechazado
 * con la redirección ANTES de consultar usuarios: permitirlo abriría una ruta
 * de enumeración de usuarios por el canal del error.
 */

const mocks = vi.hoisted(() => {
  const state = { requireRoleArgs: [] as string[][], dbTouched: false };
  const chain = (leaf: () => unknown) => {
    const c: Record<string, unknown> = {
      from: () => c,
      leftJoin: () => c,
      innerJoin: () => c,
      where: () => c,
      orderBy: () => c,
      limit: () => c,
      then: (resolve: (v: unknown) => unknown) => resolve(leaf()),
    };
    return c;
  };
  return {
    state,
    session: { role: "ADMIN" as string, id: "u-1" },
    requireRole: vi.fn(async (...roles: string[]) => {
      state.requireRoleArgs.push(roles);
      if (!roles.includes(mocks.session.role)) {
        throw new Error("NEXT_REDIRECT:/dashboard");
      }
      return { id: mocks.session.id, role: mocks.session.role };
    }),
    db: {
      select: () => {
        state.dbTouched = true;
        return chain(() => []);
      },
      insert: () => chain(() => undefined),
      update: () => chain(() => undefined),
      delete: () => chain(() => undefined),
    },
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.requireRole }));

const { default: TechniciansPage } = await import(
  "@/app/(dashboard)/technicians/page"
);

function como(rol: string) {
  mocks.session.role = rol;
}

describe("puerta de /technicians", () => {
  beforeEach(() => {
    mocks.state.requireRoleArgs.length = 0;
    mocks.state.dbTouched = false;
  });

  it("pide exactamente ADMIN o HEAD_TECHNICIAN", async () => {
    como(ROLES.ADMIN);
    await TechniciansPage().catch(() => undefined);
    const args = mocks.state.requireRoleArgs.at(-1) as string[];
    expect(args).toEqual([ROLES.ADMIN, ROLES.HEAD_TECHNICIAN]);
    // Nunca pide generar usuarios con roles que no deben entrar.
    expect(args).not.toContain(ROLES.TECHNICIAN);
    expect(args).not.toContain(ROLES.RESTAURANT_USER);
    expect(args).not.toContain(ROLES.IT_MANAGER);
  });

  it.each([
    [ROLES.TECHNICIAN],
    [ROLES.RESTAURANT_USER],
    [ROLES.IT_MANAGER],
  ])("%s es rechazado con la redirección y sin tocar la base de datos", async (rol) => {
    como(rol);
    await expect(TechniciansPage()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("ADMIN y HEAD_TECHNICIAN pasan la puerta", async () => {
    for (const rol of [ROLES.ADMIN, ROLES.HEAD_TECHNICIAN]) {
      como(rol);
      await expect(TechniciansPage()).resolves.toBeDefined();
    }
  });
});