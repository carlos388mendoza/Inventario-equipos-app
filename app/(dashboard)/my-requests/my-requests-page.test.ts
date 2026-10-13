import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLES } from "@/lib/db/enums";

/**
 * Guarda de la página "Mis solicitudes" (issue #12).
 *
 * El riesgo que se cierra: si el usuario NO tiene restaurante, la página no
 * puede filtrar y NO debe listar solicitudes sin filtro (vector de fuga). Esta
 * prueba ejercita la página completa: la guarda usa `redirect()`, y aunque la
 * lógica interna cambiase la forma de filtrar, el resto de la página seguiría
 * exigiendo un `restaurantId` resoluble.
 */

const mocks = vi.hoisted(() => {
  const state = { listRequestsCalls: [] as unknown[], dbTouched: false };
  const chain = (leaf: () => unknown) => {
    const c: Record<string, unknown> = {
      from: () => c,
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
    session: {
      role: "RESTAURANT_USER" as string,
      restaurantId: null as string | null,
    },
    scope: { restaurantId: null as string | null },
    listRequests: vi.fn(async (params: unknown) => {
      state.listRequestsCalls.push(params);
      return [];
    }),
    requireUser: vi.fn(async () => ({
      id: "u-1",
      role: mocks.session.role,
      restaurantId: mocks.session.restaurantId,
    })),
    resolveScope: vi.fn(async () => ({
      isGlobal: mocks.session.role === ROLES.ADMIN,
      role: mocks.session.role,
      restaurantId: mocks.scope.restaurantId,
      assignedRestaurantIds: [],
    })),
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
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/equipment/scope", () => ({
  resolveScope: mocks.resolveScope,
}));
vi.mock("@/lib/db/queries/requests", () => ({
  listRequests: mocks.listRequests,
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

const { default: MyRequestsPage } = await import(
  "@/app/(dashboard)/my-requests/page"
);

beforeEach(() => {
  mocks.session.role = ROLES.RESTAURANT_USER;
  mocks.session.restaurantId = null;
  mocks.scope.restaurantId = null;
  mocks.state.listRequestsCalls.length = 0;
  mocks.state.dbTouched = false;
  mocks.listRequests.mockClear();
});

describe("guarda de /my-requests", () => {
  it("RESTAURANT_USER con restaurante pasa y filtra por su unidad", async () => {
    mocks.session.role = ROLES.RESTAURANT_USER;
    mocks.session.restaurantId = "r-1";
    mocks.scope.restaurantId = "r-1";

    await expect(MyRequestsPage()).resolves.toBeDefined();
    expect(mocks.listRequests).toHaveBeenCalledTimes(1);
    expect(mocks.listRequests).toHaveBeenCalledWith({ restaurantId: "r-1" });
  });

  it.each([
    [ROLES.RESTAURANT_USER, null],
    [ROLES.ADMIN, null],
    [ROLES.TECHNICIAN, null],
    [ROLES.HEAD_TECHNICIAN, null],
    [ROLES.IT_MANAGER, null],
  ])(
    "%s sin restaurante redirige a /requests y NUNCA lista sin filtro",
    async (rol, restaurantId) => {
      mocks.session.role = rol;
      mocks.session.restaurantId = restaurantId;

      await expect(MyRequestsPage()).rejects.toThrow(/NEXT_REDIRECT:\/requests/);
      expect(mocks.listRequests).not.toHaveBeenCalled();
    },
  );

  it("la consulta sin filtro nace en un intento de restaurante sin unidad", async () => {
    // Restaurante con unidad no asignada en el scope (técnico). La guarda debe
    // prevenir que `listRequests({ restaurantId: undefined })` llegue a correr.
    mocks.session.role = ROLES.TECHNICIAN;
    mocks.session.restaurantId = null;
    mocks.scope.restaurantId = null;

    await expect(MyRequestsPage()).rejects.toThrow(/NEXT_REDIRECT:\/requests/);
    expect(mocks.listRequests).not.toHaveBeenCalled();
  });
});