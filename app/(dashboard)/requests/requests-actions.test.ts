import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  REQUEST_INSTALLATION_STATUS,
  REQUEST_STATUS,
  ROLES,
} from "@/lib/db/enums";

/**
 * Autorización y ámbito de las acciones de solicitudes.
 *
 * Dos cosas se comprueban aquí, por separado y en este orden:
 * 1. Que un rol no permitido (`requireRole`) NUNCA llega a la base de datos,
 *    porque entonces podría enumerar solicitudes por el canal del error
 *    (la redirección se propaga, no se traga).
 * 2. Que un rol permitido NO puede forzar un restaurante fuera de su ámbito:
 *    el servidor resuelve el destino real (`resolveTargetRestaurant`), que es
 *    defensa en profundidad aunque el cliente mande `restaurantId` manipulado.
 *
 * La base de datos es un double que registra lo que recibe: los tests observan
 * qué inserts/updates ocurrieron, no una conexión real.
 */

const mocks = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    inserts: [] as Record<string, unknown>[],
    updateSets: [] as Record<string, unknown>[],
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
      return chain(() => undefined);
    },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  return {
    db,
    state,
    session: {
      role: "ADMIN" as string,
      restaurantId: null as string | null,
    },
    scope: {
      current: {
        isGlobal: true,
        role: "ADMIN" as string,
        restaurantId: null as string | null,
        assignedRestaurantIds: [] as string[],
      },
    },
    notify: {
      context: null as unknown,
      failCreated: false,
      createdCalls: 0,
    },
    requireUser: vi.fn(async () => {
      if (mocks.session.role === "NO_SESSION") {
        throw new Error("NEXT_REDIRECT:/login");
      }
      return { id: "u-1", role: mocks.session.role, restaurantId: mocks.session.restaurantId };
    }),
    requireRole: vi.fn(async (...roles: string[]) => {
      if (!roles.includes(mocks.session.role)) {
        throw new Error("NEXT_REDIRECT:/dashboard");
      }
      return { id: "u-1", role: mocks.session.role, restaurantId: mocks.session.restaurantId };
    }),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/session", () => ({
  requireUser: mocks.requireUser,
  requireRole: mocks.requireRole,
}));
vi.mock("@/lib/equipment/scope", () => ({
  resolveScope: async () => mocks.scope.current,
  canAccessRestaurant: (scope: {
    isGlobal?: boolean;
    restaurantId?: string | null;
    assignedRestaurantIds?: string[];
  }, id: string) =>
    scope.isGlobal === true ||
    (scope.assignedRestaurantIds ?? []).includes(id) ||
    scope.restaurantId === id,
}));
vi.mock("@/lib/requests/notifications", () => ({
  loadRequestContext: async () => mocks.notify.context,
  notifyRequestCreated: async () => {
    if (mocks.notify.failCreated) throw new Error("fallo en el outbox");
    mocks.notify.createdCalls += 1;
  },
  notifyRequestDecision: async () => {},
  notifyInstallationResult: async () => {},
}));
vi.mock("@/lib/revalidate", () => ({ revalidateRequestViews: () => {} }));

const { createRequest, changeRequestStatus } = await import(
  "@/app/(dashboard)/requests/actions"
);

function usar(rol: string, extra?: Partial<typeof mocks.scope.current>) {
  mocks.session.role = rol;
  mocks.scope.current = {
    isGlobal: rol === ROLES.ADMIN || rol === ROLES.IT_MANAGER,
    role: rol,
    restaurantId:
      rol === ROLES.RESTAURANT_USER ? "r-1" : null,
    assignedRestaurantIds: [],
    ...extra,
  };
}

const ENTRADA_BASE = {
  equipmentTypeId: "t-1",
  priority: "NORMAL",
  kind: "purchase",
  reason: "Motivo de la solicitud válido",
};

describe("createRequest: la redirección de sesión NO se traga", () => {
  beforeEach(() => {
    mocks.state.selectQueue.length = 0;
    mocks.state.inserts.length = 0;
    mocks.state.updateSets.length = 0;
    mocks.state.dbTouched = false;
    mocks.notify.context = null;
    mocks.notify.failCreated = false;
    mocks.notify.createdCalls = 0;
  });

  it("sin sesión rechaza con la redirección y no toca la base de datos", async () => {
    usar("NO_SESSION");
    await expect(createRequest(ENTRADA_BASE)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.state.dbTouched).toBe(false);
  });
});

describe("createRequest: el destino lo decide el servidor (ámbito)", () => {
  beforeEach(() => {
    mocks.state.selectQueue.length = 0;
    mocks.state.inserts.length = 0;
    mocks.state.updateSets.length = 0;
    mocks.state.dbTouched = false;
    mocks.notify.context = null;
    mocks.notify.failCreated = false;
    mocks.notify.createdCalls = 0;
  });

  it("RESTAURANT_USER ve su restaurante aunque el cliente mienta", async () => {
    usar(ROLES.RESTAURANT_USER);
    mocks.state.selectQueue.push([{ id: "t-1" }]);
    const resultado = await createRequest({ ...ENTRADA_BASE, restaurantId: "r-999" });

    expect(resultado.ok).toBe(true);
    expect(mocks.state.inserts[0]).toMatchObject({ restaurantId: "r-1", requestedBy: "u-1" });
  });

  it("RESTAURANT_USER sin restaurante en el perfil recibe error antes de insertar", async () => {
    usar(ROLES.RESTAURANT_USER, { restaurantId: null });
    const resultado = await createRequest({ ...ENTRADA_BASE, restaurantId: "r-1" });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/asociado a un restaurante/i),
    });
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("técnico con varios restaurantes solo puede pedir para los asignados", async () => {
    usar(ROLES.TECHNICIAN, {
      isGlobal: false,
      restaurantId: null,
      assignedRestaurantIds: ["t-a", "t-b"],
    });
    mocks.state.selectQueue.push([{ id: "t-1" }]);
    const resultado = await createRequest({ ...ENTRADA_BASE, restaurantId: "t-a" });
    expect(resultado.ok).toBe(true);
    expect(mocks.state.inserts[0]).toMatchObject({ restaurantId: "t-a" });

    mocks.state.selectQueue.length = 0;
    mocks.state.inserts.length = 0;
    mocks.state.dbTouched = false;
    const ajeno = await createRequest({ ...ENTRADA_BASE, restaurantId: "t-c" });
    expect(ajeno.ok).toBe(false);
    expect(ajeno).toMatchObject({
      error: expect.stringMatching(/asignado ese restaurante/i),
    });
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("técnico con UN restaurante: sin indicar uno, usa el suyo por defecto", async () => {
    usar(ROLES.TECHNICIAN, {
      isGlobal: false,
      restaurantId: null,
      assignedRestaurantIds: ["t-único"],
    });
    mocks.state.selectQueue.push([{ id: "t-1" }]);
    const resultado = await createRequest({ ...ENTRADA_BASE, restaurantId: undefined });
    expect(resultado.ok).toBe(true);
    expect(mocks.state.inserts[0]).toMatchObject({ restaurantId: "t-único" });
  });

  it("técnico con varios restaurantes sin indicar uno no puede adivinar", async () => {
    usar(ROLES.TECHNICIAN, {
      isGlobal: false,
      restaurantId: null,
      assignedRestaurantIds: ["t-a", "t-b"],
    });
    const resultado = await createRequest({ ...ENTRADA_BASE, restaurantId: undefined });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/Selecciona el restaurante/i),
    });
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("ADMIN con alcance global sí puede elegir restaurante", async () => {
    usar(ROLES.ADMIN);
    mocks.state.selectQueue.push([{ id: "t-1" }]);
    const resultado = await createRequest({ ...ENTRADA_BASE, restaurantId: "r-global" });
    expect(resultado.ok).toBe(true);
    expect(mocks.state.inserts[0]).toMatchObject({ restaurantId: "r-global" });
  });

  it("ADMIN sin restaurante recibe error antes de insertar", async () => {
    usar(ROLES.ADMIN);
    const resultado = await createRequest({ ...ENTRADA_BASE, restaurantId: undefined });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/Selecciona el restaurante/i),
    });
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("reemplazo de un equipo que pertenece a OTRO restaurante se rechaza", async () => {
    usar(ROLES.ADMIN);
    mocks.state.selectQueue.push(
      [{ id: "t-1" }],
      [{ id: "eq-x", restaurantId: "r-otro" }],
    );
    const resultado = await createRequest({
      ...ENTRADA_BASE,
      restaurantId: "r-1",
      kind: "replacement",
      currentEquipmentId: "eq-x",
    });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/pertenece a otro restaurante/i),
    });
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("un tipo de equipo inexistente se rechaza antes de insertar", async () => {
    usar(ROLES.ADMIN);
    mocks.state.selectQueue.push([]);
    const resultado = await createRequest({ ...ENTRADA_BASE, restaurantId: "r-1" });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/no existe/i),
    });
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("una notificación que falla NO oculta que la solicitud se creó", async () => {
    usar(ROLES.ADMIN);
    mocks.state.selectQueue.push([{ id: "t-1" }]);
    mocks.notify.context = {};
    mocks.notify.failCreated = true;
    const resultado = await createRequest({ ...ENTRADA_BASE, restaurantId: "r-1" });
    expect(resultado.ok).toBe(true);
    expect(mocks.state.inserts.length).toBeGreaterThan(0);
  });
});

describe("changeRequestStatus: puerta ADMIN / IT_MANAGER", () => {
  beforeEach(() => {
    mocks.state.selectQueue.length = 0;
    mocks.state.inserts.length = 0;
    mocks.state.updateSets.length = 0;
    mocks.state.dbTouched = false;
    mocks.notify.context = null;
    mocks.notify.failCreated = false;
  });

  it("pide exactamente ADMIN o IT_MANAGER", async () => {
    usar(ROLES.TECHNICIAN);
    await changeRequestStatus({
      id: "req-1",
      newStatus: REQUEST_STATUS.APPROVED,
    }).catch(() => undefined);
    const args = mocks.requireRole.mock.calls.at(-1) as string[];
    expect(args).toEqual([ROLES.ADMIN, ROLES.IT_MANAGER]);
  });

  it("un técnico no llega a la base de datos (rechazo con la redirección)", async () => {
    usar(ROLES.TECHNICIAN);
    await expect(
      changeRequestStatus({ id: "req-1", newStatus: REQUEST_STATUS.APPROVED }),
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.state.dbTouched).toBe(false);
  });

  it("IT_MANAGER aprueba y agenda el seguimiento de 5 días", async () => {
    usar(ROLES.IT_MANAGER);
    mocks.state.selectQueue.push([
      { id: "req-1", status: REQUEST_STATUS.PENDING, installationStatus: REQUEST_INSTALLATION_STATUS.PENDING },
    ]);
    const ahora = Date.now();
    const resultado = await changeRequestStatus({
      id: "req-1",
      newStatus: REQUEST_STATUS.APPROVED,
      comment: "ok",
    });
    expect(resultado.ok).toBe(true);
    const set = mocks.state.updateSets[0];
    expect(set.status).toBe(REQUEST_STATUS.APPROVED);
    expect(set.installationStatus).toBe(REQUEST_INSTALLATION_STATUS.PENDING);
    expect(set.followUpSentAt).toBeNull();
    const due = set.followUpDueAt as Date;
    expect(due.getTime() - ahora).toBeCloseTo(5 * 24 * 60 * 60 * 1000, -6);
  });

  it("reaprobar una solicitud YA confirmada no reinicia el seguimiento", async () => {
    usar(ROLES.ADMIN);
    mocks.state.selectQueue.push([
      { id: "req-1", status: REQUEST_STATUS.CANCELLED, installationStatus: REQUEST_INSTALLATION_STATUS.CONFIRMED },
    ]);
    const resultado = await changeRequestStatus({
      id: "req-1",
      newStatus: REQUEST_STATUS.APPROVED,
    });
    expect(resultado.ok).toBe(true);
    const set = mocks.state.updateSets[0];
    expect(set.status).toBe(REQUEST_STATUS.APPROVED);
    // No se vuelve a abrir la instalación ni se agenda un nuevo correo.
    expect(set).not.toHaveProperty("installationStatus");
    expect(set).not.toHaveProperty("followUpSentAt");
    expect(set).not.toHaveProperty("followUpDueAt");
  });

  it("cambiar a un estado que ya tiene la solicitud es un error sin update", async () => {
    usar(ROLES.ADMIN);
    mocks.state.selectQueue.push([
      { id: "req-1", status: REQUEST_STATUS.APPROVED, installationStatus: REQUEST_INSTALLATION_STATUS.PENDING },
    ]);
    const resultado = await changeRequestStatus({
      id: "req-1",
      newStatus: REQUEST_STATUS.APPROVED,
    });
    expect(resultado.ok).toBe(false);
    expect(resultado).toMatchObject({
      error: expect.stringMatching(/ya tiene ese estado/i),
    });
    expect(mocks.state.updateSets).toHaveLength(0);
  });
});