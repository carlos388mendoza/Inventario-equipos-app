import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLES } from "@/lib/db/enums";

/**
 * Autorización de la gestión de usuarios (solo ADMIN para crear/editar roles;
 * ADMIN y HEAD_TECHNICIAN solo para reasignar técnicos).
 *
 * Igual que en movimientos, lo que se comprueba es que un rol no permitido no
 * llega a la base de datos (si la puerta fallara, el error permitiría enumerar
 * usuarios), y que las reglas de negocio (#16) se aplican en servidor:
 * - El jefe de técnicos no puede reasignarse a sí mismo.
 * - Solo se puede reasignar a usuarios técnicos.
 * - Un usuario de restaurante exige restaurante asignado.
 */

const mocks = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    inserts: [] as Record<string, unknown>[],
    updateSets: [] as Record<string, unknown>[],
    deleteCalled: 0,
    dbTouched: false,
  };
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
  const db = {
    select: () => {
      state.dbTouched = true;
      return chain(() => state.selectQueue.shift() ?? []);
    },
    insert: () => {
      state.dbTouched = true;
      return {
        values: (payload: Record<string, unknown>) => {
          state.inserts.push(payload);
          return chain(() => undefined);
        },
      };
    },
    update: () => {
      state.dbTouched = true;
      return {
        set: (payload: Record<string, unknown>) => {
          state.updateSets.push(payload);
          return chain(() => undefined);
        },
      };
    },
    delete: () => {
      state.dbTouched = true;
      state.deleteCalled += 1;
      return chain(() => undefined);
    },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  return {
    db,
    state,
    session: { role: "ADMIN" as string, id: "u-1" },
    createUser: vi.fn(async () => "user-nuevo"),
    revokeUserSessions: vi.fn(async () => undefined),
    requireRole: vi.fn(async (...roles: string[]) => {
      if (!roles.includes(mocks.session.role)) {
        throw new Error("NEXT_REDIRECT:/dashboard");
      }
      return { id: mocks.session.id, role: mocks.session.role };
    }),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/auth/users", () => ({
  createUser: mocks.createUser,
  revokeUserSessions: mocks.revokeUserSessions,
}));
vi.mock("@/lib/revalidate", () => ({ revalidateUserViews: () => {} }));

const {
  createUserAction,
  updateUserAction,
  setTechnicianAssignmentsAction,
  toggleUserActiveAction,
  deleteUserAction,
} = await import("@/app/(dashboard)/users/actions");

function como(rol: string, id = "u-1") {
  mocks.session.role = rol;
  mocks.session.id = id;
}

const TECNICO_JOHANA = {
  name: "Johana Técnica",
  email: "johana@test.local",
  password: "contraseña-123",
  role: ROLES.TECHNICIAN,
  restaurantIds: ["r-a", "r-b"],
};

beforeEach(() => {
  mocks.state.selectQueue.length = 0;
  mocks.state.inserts.length = 0;
  mocks.state.updateSets.length = 0;
  mocks.state.deleteCalled = 0;
  mocks.state.dbTouched = false;
  mocks.createUser.mockClear();
  mocks.revokeUserSessions.mockClear();
  mocks.requireRole.mockClear();
});

describe("usuarios: la puerta es solo ADMIN para crear y editar", () => {
  it("createUserAction rechaza a un técnico antes de tocar la base de datos", async () => {
    como(ROLES.TECHNICIAN);
    await expect(createUserAction(TECNICO_JOHANA)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("updateUserAction rechaza a un HEAD antes de tocar la base de datos", async () => {
    como(ROLES.HEAD_TECHNICIAN);
    await expect(
      updateUserAction({ id: "u-x", name: "X", email: "x@test.local", role: ROLES.TECHNICIAN, active: true }),
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("toggleUserActiveAction rechaza a un usuario de restaurante", async () => {
    como(ROLES.RESTAURANT_USER);
    await expect(toggleUserActiveAction({ id: "u-x", active: false })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("create y update piden exactamente ADMIN", async () => {
    await createUserAction(TECNICO_JOHANA).catch(() => undefined);
    await updateUserAction({ id: "u-x", name: "X", email: "x@test.local", role: ROLES.TECHNICIAN, active: true }).catch(() => undefined);
    const calls = mocks.requireRole.mock.calls;
    expect(calls).toHaveLength(2);
    for (const args of calls) expect(args).toEqual([ROLES.ADMIN]);
  });
});

describe("createUserAction: reglas de negocio", () => {
  it("RESTAURANT_USER sin restaurante es error de validación (no crea usuario)", async () => {
    como(ROLES.ADMIN);
    const resultado = await createUserAction({
      name: "Carmen",
      email: "carmen@test.local",
      password: "contraseña-123",
      role: ROLES.RESTAURANT_USER,
      restaurantId: "",
    });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/restaurante/i),
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("crear un técnico guarda sus asignaciones y le quita restaurantId", async () => {
    como(ROLES.ADMIN);
    // R1: validación previa al alta (para no crear el usuario) y validación
    // dentro de setUserRestaurantAssignments antes de borrar/reinsertar.
    mocks.state.selectQueue.push([{ id: "r-a" }, { id: "r-b" }]);
    mocks.state.selectQueue.push([{ id: "r-a" }, { id: "r-b" }]);
    const resultado = await createUserAction(TECNICO_JOHANA);
    expect(resultado.ok).toBe(true);
    expect(mocks.createUser).toHaveBeenCalledWith({
      name: "Johana Técnica",
      email: "johana@test.local",
      password: "contraseña-123",
      role: ROLES.TECHNICIAN,
      restaurantId: null,
    });
    // setUserRestaurantAssignments borra y reinserta las asignaciones.
    expect(mocks.state.deleteCalled).toBeGreaterThanOrEqual(1);
    expect(mocks.state.inserts.at(-1)).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: "user-nuevo" })]),
    );
  });

  it("crear un técnico con un restaurante inválido NO crea al usuario (R1)", async () => {
    como(ROLES.ADMIN);
    // El catálogo activo no contiene el restaurante pedido.
    mocks.state.selectQueue.push([]);
    const resultado = await createUserAction({
      ...TECNICO_JOHANA,
      restaurantIds: ["r-inexistente"],
    });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/no existen o están inactivos/i),
    });
    // La validación corre antes del alta: el usuario no se crea.
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.state.inserts).toHaveLength(0);
    expect(mocks.state.deleteCalled).toBe(0);
  });
});

describe("setTechnicianAssignmentsAction: puerta y reglas (#16)", () => {
  it("pide exactamente ADMIN o HEAD_TECHNICIAN", async () => {
    como(ROLES.ADMIN);
    mocks.state.selectQueue.push([{ role: ROLES.TECHNICIAN }]);
    mocks.state.selectQueue.push([{ id: "r-a" }]);
    await setTechnicianAssignmentsAction({ userId: "u-2", restaurantIds: ["r-a"] });
    const args = mocks.requireRole.mock.calls.at(-1) as string[];
    expect(args).toEqual([ROLES.ADMIN, ROLES.HEAD_TECHNICIAN]);
  });

  it("un técnico no llega a la base de datos", async () => {
    como(ROLES.TECHNICIAN);
    await expect(
      setTechnicianAssignmentsAction({ userId: "u-2", restaurantIds: ["r-a"] }),
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("ADMIN reasigna a un técnico", async () => {
    como(ROLES.ADMIN);
    mocks.state.selectQueue.push([{ role: ROLES.TECHNICIAN }]);
    mocks.state.selectQueue.push([{ id: "r-a" }]);
    const resultado = await setTechnicianAssignmentsAction({
      userId: "u-2",
      restaurantIds: ["r-a", "r-a", ""],
    });
    expect(resultado.ok).toBe(true);
    // Borra las asignaciones actuales y reinserta las únicas no vacías.
    expect(mocks.state.deleteCalled).toBe(1);
    expect(mocks.state.inserts.at(-1)).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: "u-2" })]),
    );
  });

  it("rechaza restaurantes inexistentes o inactivos sin borrar ni insertar (#17/#18)", async () => {
    como(ROLES.ADMIN);
    mocks.state.selectQueue.push([{ role: ROLES.TECHNICIAN }]);
    // El catálogo activo no contiene el restaurante pedido.
    mocks.state.selectQueue.push([]);
    const resultado = await setTechnicianAssignmentsAction({
      userId: "u-2",
      restaurantIds: ["r-inexistente"],
    });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/no existen o están inactivos/i),
    });
    // La validación corre ANTES de mutar: nada se borra ni se inserta.
    expect(mocks.state.deleteCalled).toBe(0);
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("solo acepta restaurantes presentes en el catálogo activo", async () => {
    como(ROLES.ADMIN);
    mocks.state.selectQueue.push([{ role: ROLES.TECHNICIAN }]);
    // De los dos pedidos, solo r-a está activo: la operación completa falla.
    mocks.state.selectQueue.push([{ id: "r-a" }]);
    const resultado = await setTechnicianAssignmentsAction({
      userId: "u-2",
      restaurantIds: ["r-a", "r-inactivo"],
    });
    expect(resultado.ok).toBe(false);
    expect(mocks.state.deleteCalled).toBe(0);
  });

  it("no permite reasignar a un usuario que NO es técnico", async () => {
    como(ROLES.ADMIN);
    mocks.state.selectQueue.push([{ role: ROLES.RESTAURANT_USER }]);
    const resultado = await setTechnicianAssignmentsAction({
      userId: "u-2",
      restaurantIds: ["r-a"],
    });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/no es un técnico/i),
    });
    expect(mocks.state.deleteCalled).toBe(0);
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("un HEAD puede reasignarse a sí mismo (#18)", async () => {
    como(ROLES.HEAD_TECHNICIAN, "u-2");
    mocks.state.selectQueue.push([{ role: ROLES.HEAD_TECHNICIAN }]);
    mocks.state.selectQueue.push([{ id: "r-a" }]);
    const resultado = await setTechnicianAssignmentsAction({
      userId: "u-2",
      restaurantIds: ["r-a"],
    });
    expect(resultado.ok).toBe(true);
    expect(mocks.state.deleteCalled).toBe(1);
    expect(mocks.state.inserts.at(-1)).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: "u-2" })]),
    );
  });

  it("un HEAD puede reasignar a OTRO técnico", async () => {
    como(ROLES.HEAD_TECHNICIAN, "u-1");
    mocks.state.selectQueue.push([{ role: ROLES.TECHNICIAN }]);
    mocks.state.selectQueue.push([{ id: "r-a" }]);
    const resultado = await setTechnicianAssignmentsAction({
      userId: "u-2",
      restaurantIds: ["r-a"],
    });
    expect(resultado.ok).toBe(true);
    expect(mocks.state.inserts.at(-1)).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: "u-2" })]),
    );
  });
});

describe("deleteUserAction: la puerta es solo ADMIN", () => {
  it("rechaza a un jefe de técnicos antes de tocar la base de datos", async () => {
    como(ROLES.HEAD_TECHNICIAN);
    await expect(deleteUserAction({ id: "u-x" })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("pide exactamente ADMIN", async () => {
    como(ROLES.ADMIN);
    mocks.state.selectQueue.push([
      { id: "u-2", role: ROLES.RESTAURANT_USER, active: true, deletedAt: null },
    ]);
    await deleteUserAction({ id: "u-2" });
    const args = mocks.requireRole.mock.calls.at(-1) as string[];
    expect(args).toEqual([ROLES.ADMIN]);
  });
});

describe("deleteUserAction: baja lógica (conserva el historial)", () => {
  it("marca deletedAt y desactiva, sin borrar filas, y revoca sesiones", async () => {
    como(ROLES.ADMIN, "u-1");
    mocks.state.selectQueue.push([
      { id: "u-2", role: ROLES.RESTAURANT_USER, active: true, deletedAt: null },
    ]);
    const resultado = await deleteUserAction({ id: "u-2" });
    expect(resultado.ok).toBe(true);

    // No se borra ninguna fila: solicitudes, equipos y movimientos quedan intactos.
    expect(mocks.state.deleteCalled).toBe(0);

    const set = mocks.state.updateSets.at(-1)!;
    expect(set.deletedAt).toBeInstanceOf(Date);
    expect(set.active).toBe(false);
    // Se conservan rol y restaurante (no se envían en el UPDATE).
    expect(set).not.toHaveProperty("role");
    expect(set).not.toHaveProperty("restaurantId");

    expect(mocks.revokeUserSessions).toHaveBeenCalledWith("u-2");
  });
});

describe("último administrador activo: protegido", () => {
  it("no elimina al único admin activo", async () => {
    como(ROLES.ADMIN, "u-1");
    mocks.state.selectQueue.push([
      { id: "u-2", role: ROLES.ADMIN, active: true, deletedAt: null },
    ]);
    mocks.state.selectQueue.push([{ id: "u-2" }]); // listActiveAdminIds: solo él
    const resultado = await deleteUserAction({ id: "u-2" });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/último administrador/i),
    });
    expect(mocks.state.updateSets).toHaveLength(0);
    expect(mocks.revokeUserSessions).not.toHaveBeenCalled();
  });

  it("no desactiva al único admin activo", async () => {
    como(ROLES.ADMIN, "u-1");
    mocks.state.selectQueue.push([
      { id: "u-2", role: ROLES.ADMIN, active: true, deletedAt: null },
    ]);
    mocks.state.selectQueue.push([{ id: "u-2" }]);
    const resultado = await toggleUserActiveAction({ id: "u-2", active: false });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/último administrador/i),
    });
    expect(mocks.state.updateSets).toHaveLength(0);
  });

  it("permite eliminar a un admin si queda otro admin activo", async () => {
    como(ROLES.ADMIN, "u-1");
    mocks.state.selectQueue.push([
      { id: "u-2", role: ROLES.ADMIN, active: true, deletedAt: null },
    ]);
    mocks.state.selectQueue.push([{ id: "u-1" }, { id: "u-2" }]);
    const resultado = await deleteUserAction({ id: "u-2" });
    expect(resultado.ok).toBe(true);
  });
});

describe("auto-bloqueo: un admin no puede tocarse a sí mismo", () => {
  it("no se desactiva a sí mismo", async () => {
    como(ROLES.ADMIN, "u-1");
    mocks.state.selectQueue.push([
      { id: "u-1", role: ROLES.ADMIN, active: true, deletedAt: null },
    ]);
    const resultado = await toggleUserActiveAction({ id: "u-1", active: false });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/propia cuenta/i),
    });
    expect(mocks.state.updateSets).toHaveLength(0);
  });

  it("no se elimina a sí mismo", async () => {
    como(ROLES.ADMIN, "u-1");
    mocks.state.selectQueue.push([
      { id: "u-1", role: ROLES.ADMIN, active: true, deletedAt: null },
    ]);
    const resultado = await deleteUserAction({ id: "u-1" });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/propia cuenta/i),
    });
    expect(mocks.revokeUserSessions).not.toHaveBeenCalled();
  });
});

describe("cuentas dadas de baja: no se reactivan ni se vuelven a tocar", () => {
  it("toggle rechaza una cuenta dada de baja", async () => {
    como(ROLES.ADMIN, "u-1");
    mocks.state.selectQueue.push([
      { id: "u-2", role: ROLES.RESTAURANT_USER, active: false, deletedAt: new Date() },
    ]);
    const resultado = await toggleUserActiveAction({ id: "u-2", active: true });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/baja/i),
    });
    expect(mocks.state.updateSets).toHaveLength(0);
  });

  it("delete rechaza una cuenta ya dada de baja", async () => {
    como(ROLES.ADMIN, "u-1");
    mocks.state.selectQueue.push([
      { id: "u-2", role: ROLES.RESTAURANT_USER, active: false, deletedAt: new Date() },
    ]);
    const resultado = await deleteUserAction({ id: "u-2" });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/ya está dada de baja/i),
    });
  });
});

describe("toggleUserActiveAction: conserva rol y restaurante y revoca sesiones", () => {
  it("desactivar solo cambia active y revoca las sesiones", async () => {
    como(ROLES.ADMIN, "u-1");
    mocks.state.selectQueue.push([
      { id: "u-2", role: ROLES.RESTAURANT_USER, active: true, deletedAt: null },
    ]);
    const resultado = await toggleUserActiveAction({ id: "u-2", active: false });
    expect(resultado.ok).toBe(true);
    const set = mocks.state.updateSets.at(-1)!;
    expect(set.active).toBe(false);
    expect(set).not.toHaveProperty("role");
    expect(set).not.toHaveProperty("restaurantId");
    expect(mocks.revokeUserSessions).toHaveBeenCalledWith("u-2");
  });
});

describe("updateUserAction: no permite autodespojarse del rol admin", () => {
  it("bloquea quitarse a sí mismo el rol de administrador", async () => {
    como(ROLES.ADMIN, "u-1");
    mocks.state.selectQueue.push([
      { id: "u-1", role: ROLES.ADMIN, active: true, deletedAt: null },
    ]);
    const resultado = await updateUserAction({
      id: "u-1",
      name: "Admin",
      email: "a@test.local",
      role: ROLES.IT_MANAGER,
    });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/quitarte/i),
    });
    expect(mocks.state.updateSets).toHaveLength(0);
  });
});

describe("updateUserAction: valida asignaciones antes de actualizar (R1)", () => {
  it("un restaurante inválido NO actualiza al usuario", async () => {
    como(ROLES.ADMIN, "u-1");
    // getUserAccount devuelve al técnico objetivo.
    mocks.state.selectQueue.push([
      { id: "u-2", role: ROLES.TECHNICIAN, active: true, deletedAt: null },
    ]);
    // Validación previa: el catálogo activo no contiene el restaurante pedido.
    mocks.state.selectQueue.push([]);
    const resultado = await updateUserAction({
      id: "u-2",
      name: "Técnico Dos",
      email: "tec2@test.local",
      role: ROLES.TECHNICIAN,
      restaurantIds: ["r-inexistente"],
    });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/no existen o están inactivos/i),
    });
    // No se actualiza el usuario ni se tocan las asignaciones.
    expect(mocks.state.updateSets).toHaveLength(0);
    expect(mocks.state.deleteCalled).toBe(0);
    expect(mocks.state.inserts).toHaveLength(0);
  });
});