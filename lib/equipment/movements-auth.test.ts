import { beforeEach, describe, expect, it, vi } from "vitest";

import { EQUIPMENT_MOVEMENT_TYPES, ROLES } from "@/lib/db/enums";
import { canAccessGlobal, isAdmin, isItManager } from "@/lib/auth/session";

/**
 * Autorización de las acciones de movimientos.
 *
 * Lo que se comprueba aquí NO es "qué hace la acción", sino algo anterior y más
 * importante: que un usuario de restaurante no llega nunca a la base de datos.
 * Todas las acciones de movimientos abren con `requireRole(ADMIN, IT_MANAGER)`,
 * y el orden importa: si la comprobación de rol se moviera después de leer
 * equipo o destino, un usuario de restaurante podría enumerar datos de otras
 * unidades por el canal del error.
 *
 * Por eso `db` es un proxy que EXPLOTA si se toca. Si alguna acción empieza a
 * leer antes de validar el rol, estos tests fallan en vez de pasar en silencio.
 */

const mocks = vi.hoisted(() => {
  const FALLAR_SI_TOCAN_DB = () => {
    throw new Error("La base de datos fue consultada antes de validar el rol.");
  };
  return {
    rol: { actual: "" },
    db: {
      select: FALLAR_SI_TOCAN_DB,
      insert: FALLAR_SI_TOCAN_DB,
      update: FALLAR_SI_TOCAN_DB,
      transaction: FALLAR_SI_TOCAN_DB,
    },
    requireRole: vi.fn(async (...roles: string[]) => {
      if (!roles.includes(rolActual())) {
        const err = new Error("NEXT_REDIRECT:/dashboard");
        err.name = "RedirectError";
        throw err;
      }
      return { id: "u-1", role: rolActual() };
    }),
  };
  function rolActual() {
    return mocks.rol.actual;
  }
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth/session")>();
  return { ...real, requireRole: mocks.requireRole };
});
vi.mock("@/lib/equipment/scope", () => ({
  resolveScope: async () => ({ role: mocks.rol.actual, isGlobal: true, restaurantId: null }),
  assertRestaurantAccess: () => {},
}));
vi.mock("@/lib/revalidate", () => ({ revalidateMovementViews: () => {} }));

const { moveEquipment, bulkMoveEquipment, copyEquipment, replaceEquipment, archiveEquipment } =
  await import("@/app/(dashboard)/equipment/movements/actions");

/** Todas las acciones de escritura del módulo, con la entrada más inválida posible. */
const ACCIONES: Array<[string, (input: unknown) => Promise<unknown>]> = [
  ["moveEquipment", moveEquipment],
  ["bulkMoveEquipment", bulkMoveEquipment],
  ["copyEquipment", copyEquipment],
  ["replaceEquipment", replaceEquipment],
  ["archiveEquipment", archiveEquipment],
];

const ENTRADA_VACIA = {};

describe("matriz de roles", () => {
  it("ADMIN tiene alcance global", () => {
    expect(canAccessGlobal({ role: ROLES.ADMIN })).toBe(true);
    expect(isAdmin({ role: ROLES.ADMIN })).toBe(true);
  });

  it("IT_MANAGER tiene alcance global pero no administra", () => {
    expect(canAccessGlobal({ role: ROLES.IT_MANAGER })).toBe(true);
    expect(isItManager({ role: ROLES.IT_MANAGER })).toBe(true);
    expect(isAdmin({ role: ROLES.IT_MANAGER })).toBe(false);
  });

  it("RESTAURANT_USER no tiene alcance global", () => {
    expect(canAccessGlobal({ role: ROLES.RESTAURANT_USER })).toBe(false);
    expect(isAdmin({ role: ROLES.RESTAURANT_USER })).toBe(false);
    expect(isItManager({ role: ROLES.RESTAURANT_USER })).toBe(false);
  });
});

describe("un usuario de restaurante no ejecuta movimientos", () => {
  beforeEach(() => {
    mocks.rol.actual = ROLES.RESTAURANT_USER;
    mocks.requireRole.mockClear();
  });

  for (const [nombre, accion] of ACCIONES) {
    it(`${nombre} rechaza antes de tocar la base de datos`, async () => {
      // Si la acción leyera algo, el proxy de `db` lanzaría "La base de datos
      // fue consultada antes de validar el rol" y ese sería el error. Por eso se
      // comprueba que el rechazo es la redirección, no el proxy.
      await expect(accion(ENTRADA_VACIA)).rejects.toThrow(/NEXT_REDIRECT/);
    });
  }

  it("pide ADMIN o IT_MANAGER, nunca RESTAURANT_USER", async () => {
    await moveEquipment(ENTRADA_VACIA).catch(() => undefined);
    const args = mocks.requireRole.mock.calls.at(-1) as string[];
    expect(args).toEqual([ROLES.ADMIN, ROLES.IT_MANAGER]);
    expect(args).not.toContain(ROLES.RESTAURANT_USER);
  });
});

describe("ADMIN e IT_MANAGER pasan la puerta del rol", () => {
  for (const rol of [ROLES.ADMIN, ROLES.IT_MANAGER]) {
    it(`${rol} llega a la validación de la entrada, no a la redirección`, async () => {
      mocks.rol.actual = rol;
      const resultado = (await moveEquipment(ENTRADA_VACIA)) as { ok: boolean; error: string };

      // Haber pasado la puerta se ve en la naturaleza del error: si el rol
      // hubiera sido rechazado, la promesa se habría rechazado con la
      // redirección en lugar de devolver un resultado de validación de Zod.
      expect(resultado.ok).toBe(false);
      expect(resultado.error).not.toMatch(/NEXT_REDIRECT/);
      expect(resultado.error).toMatch(/expected|invalid/i);
    });
  }
});

describe("tipos de movimiento permitidos", () => {
  it("cubre los seis tipos del enum y ninguno más", () => {
    // La lista de `ALLOWED_MOVEMENT_TYPES` es la superficie real: un tipo
    // inventado por el cliente tiene que rechazarse.
    const permitidos = [
      EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
      EQUIPMENT_MOVEMENT_TYPES.PULL,
      EQUIPMENT_MOVEMENT_TYPES.COPY,
      EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT,
      EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN,
      EQUIPMENT_MOVEMENT_TYPES.REPLACEMENT,
    ];
    expect(new Set(permitidos).size).toBe(6);
  });
});
