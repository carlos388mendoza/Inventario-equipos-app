import { describe, expect, it } from "vitest";

import { EQUIPMENT_MOVEMENT_TYPES, EQUIPMENT_STATUS } from "../db/enums";
import {
  BATCH_MOVEMENTS,
  MOVEMENT_DEFINITIONS,
  SINGLE_EQUIPMENT_MOVEMENTS,
  checkCopyInput,
  checkLocationChange,
  checkReplacement,
  deletionBlockedMessage,
  describeDeletionBlockers,
  effectiveOwnerRestaurantId,
  isOnLoan,
  movementDescription,
  suggestAssetCode,
  summarizeBatch,
  validateBatch,
  type MovableEquipment,
} from "./movements";

function equipment(overrides: Partial<MovableEquipment> = {}): MovableEquipment {
  return {
    id: "eq-1",
    assetCode: "PH01-0001",
    serialNumber: "SN-0001",
    equipmentTypeId: "type-1",
    restaurantId: "rest-a",
    ownerRestaurantId: null,
    status: EQUIPMENT_STATUS.ACTIVE,
    ...overrides,
  };
}

describe("catálogo de movimientos", () => {
  it("cubre los seis tipos con una definición completa", () => {
    for (const definition of Object.values(MOVEMENT_DEFINITIONS)) {
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(10);
      expect(definition.allowedStatuses.length).toBeGreaterThan(0);
    }
  });

  it("solo la copia y la sustitución crean un equipo nuevo", () => {
    const creators = Object.values(MOVEMENT_DEFINITIONS)
      .filter((d) => d.createsEquipment)
      .map((d) => d.type);
    expect(creators).toEqual([
      EQUIPMENT_MOVEMENT_TYPES.COPY,
      EQUIPMENT_MOVEMENT_TYPES.REPLACEMENT,
    ]);
  });

  it("excluye la devolución de la lista de movimientos simples", () => {
    // La devolución solo aparece cuando el equipo está en préstamo, así que no
    // se ofrece como una operación libre.
    expect(SINGLE_EQUIPMENT_MOVEMENTS).not.toContain(
      EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN
    );
  });

  it("ofrece lote para traslado, jalado y préstamo, no para copia ni sustitución", () => {
    expect(BATCH_MOVEMENTS).toEqual([
      EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
      EQUIPMENT_MOVEMENT_TYPES.PULL,
      EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT,
    ]);
    for (const type of BATCH_MOVEMENTS) {
      expect(MOVEMENT_DEFINITIONS[type].supportsBatch).toBe(true);
    }
  });
});

describe("préstamo", () => {
  it("no está en préstamo cuando el propietario es la ubicación", () => {
    expect(
      isOnLoan(
        equipment({ restaurantId: "rest-a", ownerRestaurantId: "rest-a" })
      )
    ).toBe(false);
  });

  it("no está en préstamo cuando no hay propietario explícito", () => {
    expect(isOnLoan(equipment({ ownerRestaurantId: null }))).toBe(false);
  });

  it("está en préstamo cuando el propietario difiere de la ubicación", () => {
    expect(
      isOnLoan(
        equipment({ restaurantId: "rest-b", ownerRestaurantId: "rest-a" })
      )
    ).toBe(true);
  });

  it("el propietario efectivo cae a la ubicación actual", () => {
    expect(effectiveOwnerRestaurantId(equipment({ ownerRestaurantId: null }))).toBe(
      "rest-a"
    );
    expect(
      effectiveOwnerRestaurantId(
        equipment({ restaurantId: "rest-b", ownerRestaurantId: "rest-a" })
      )
    ).toBe("rest-a");
  });
});

describe("checkLocationChange", () => {
  it("rechaza un destino vacío", () => {
    expect(checkLocationChange(equipment(), EQUIPMENT_MOVEMENT_TYPES.TRANSFER, "")).toEqual({
      ok: false,
      error: "Selecciona la unidad destino.",
    });
  });

  it("rechaza mover a la misma unidad", () => {
    const result = checkLocationChange(
      equipment(),
      EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
      "rest-a"
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("ya está en esa unidad");
  });

  it("acepta un traslado a otra unidad", () => {
    expect(
      checkLocationChange(equipment(), EQUIPMENT_MOVEMENT_TYPES.TRANSFER, "rest-b").ok
    ).toBe(true);
  });

  it("no traslada un equipo prestado, para que la devolución quede registrada", () => {
    const loaned = equipment({ restaurantId: "rest-b", ownerRestaurantId: "rest-a" });
    for (const type of [EQUIPMENT_MOVEMENT_TYPES.TRANSFER, EQUIPMENT_MOVEMENT_TYPES.PULL]) {
      const result = checkLocationChange(loaned, type, "rest-c");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Devolución");
    }
  });

  it("no presta un equipo ya prestado", () => {
    const loaned = equipment({ restaurantId: "rest-b", ownerRestaurantId: "rest-a" });
    const result = checkLocationChange(
      loaned,
      EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT,
      "rest-c"
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("devuélvelo");
  });

  it("no presta un equipo fuera de servicio", () => {
    const retired = equipment({ status: EQUIPMENT_STATUS.RETIRED });
    const result = checkLocationChange(
      retired,
      EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT,
      "rest-b"
    );
    expect(result.ok).toBe(false);
  });

  it("no mueve un equipo retirado", () => {
    const retired = equipment({ status: EQUIPMENT_STATUS.RETIRED });
    expect(
      checkLocationChange(retired, EQUIPMENT_MOVEMENT_TYPES.TRANSFER, "rest-b").ok
    ).toBe(false);
    expect(
      checkLocationChange(retired, EQUIPMENT_MOVEMENT_TYPES.REPLACEMENT, "rest-b").ok
    ).toBe(false);
  });

  it("devuelve solo al propietario", () => {
    const loaned = equipment({ restaurantId: "rest-b", ownerRestaurantId: "rest-a" });
    expect(
      checkLocationChange(loaned, EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN, "rest-a").ok
    ).toBe(true);
    const wrong = checkLocationChange(
      loaned,
      EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN,
      "rest-c"
    );
    expect(wrong.ok).toBe(false);
    expect(wrong.error).toContain("unidad propietaria");
  });

  it("no inventa devoluciones para equipos que no están prestados", () => {
    const result = checkLocationChange(
      equipment(),
      EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN,
      "rest-a"
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("no está en préstamo");
  });

  it("el estado del préstamo se diagnostica antes que el destino", () => {
    // Un equipo no prestado en "rest-a" al que se le pide devolver a "rest-a"
    // incumple dos reglas a la vez. La útil es la del préstamo.
    const notLoaned = equipment({ restaurantId: "rest-a" });
    expect(
      checkLocationChange(notLoaned, EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN, "rest-a")
        .error
    ).toContain("no está en préstamo");
  });
});

describe("checkCopyInput", () => {
  const original = equipment();

  it("exige código de activo", () => {
    const result = checkCopyInput(original, { assetCode: "  " }, new Set(), new Set());
    expect(result.ok).toBe(false);
  });

  it("no permite copiar un equipo fuera de servicio", () => {
    for (const status of [EQUIPMENT_STATUS.RETIRED, EQUIPMENT_STATUS.REPLACED]) {
      const result = checkCopyInput(
        { ...original, status },
        { assetCode: "PH01-0001-C" },
        new Set(),
        new Set()
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain("fuera de servicio");
    }
  });

  it("rechaza reutilizar el código del original", () => {
    const result = checkCopyInput(
      original,
      { assetCode: "ph01-0001" },
      new Set(),
      new Set()
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("distinto al original");
  });

  it("rechaza un código ya ocupado", () => {
    const result = checkCopyInput(
      original,
      { assetCode: "OTRO-1" },
      new Set(["OTRO-1"]),
      new Set()
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Ya existe");
  });

  it("rechaza heredar el número de serie del original", () => {
    const result = checkCopyInput(
      original,
      { assetCode: "PH01-0001-C", serialNumber: "sn-0001" },
      new Set(),
      new Set()
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("mismo número de serie");
  });

  it("acepta una serie vacía: aún no se conoce", () => {
    expect(
      checkCopyInput(
        original,
        { assetCode: "PH01-0001-C", serialNumber: "  " },
        new Set(),
        new Set()
      ).ok
    ).toBe(true);
  });

  it("rechaza una serie que ya existe en otro equipo", () => {
    const result = checkCopyInput(
      original,
      { assetCode: "PH01-0001-C", serialNumber: "SN-9999" },
      new Set(),
      new Set(["SN-9999"])
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Ya existe");
  });

  it("normaliza el código a mayúsculas", () => {
    expect(
      checkCopyInput(
        original,
        { assetCode: " ph01-0001-c " },
        new Set(["PH01-0001-C"]),
        new Set()
      ).ok
    ).toBe(false);
  });
});

describe("checkReplacement", () => {
  it("rechaza sustituir un equipo ya fuera de servicio", () => {
    const replaced = equipment({ status: EQUIPMENT_STATUS.REPLACED });
    const result = checkReplacement(replaced, "PH01-0001-N", new Set());
    expect(result.ok).toBe(false);
  });

  it("rechaza un código de activo repetido", () => {
    expect(checkReplacement(equipment(), "PH01-0001", new Set()).ok).toBe(false);
    expect(
      checkReplacement(equipment(), "NUEVO-1", new Set(["NUEVO-1"])).ok
    ).toBe(false);
  });

  it("acepta un sustituto válido", () => {
    expect(checkReplacement(equipment(), "PH01-0001-N", new Set(["PH01-0001"])).ok).toBe(
      true
    );
  });
});

describe("validateBatch", () => {
  const items = [
    equipment({ id: "a", assetCode: "A-1", restaurantId: "rest-a" }),
    equipment({ id: "b", assetCode: "B-1", restaurantId: "rest-b" }),
  ];

  it("acepta el lote completo cuando todos son válidos", () => {
    const result = validateBatch(items, EQUIPMENT_MOVEMENT_TYPES.TRANSFER, "rest-c");
    expect(result.allOrNothing).toBe(true);
    expect(result.valid).toHaveLength(2);
    expect(result.rejected).toHaveLength(0);
  });

  it("es todo o nada: un rechazo invalida el lote", () => {
    const result = validateBatch(
      [...items, equipment({ id: "c", assetCode: "C-1", restaurantId: "rest-c" })],
      EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
      "rest-c"
    );
    expect(result.allOrNothing).toBe(false);
    expect(result.valid).toHaveLength(2);
    expect(result.rejected).toEqual([
      {
        id: "c",
        assetCode: "C-1",
        check: { ok: false, error: "El equipo ya está en esa unidad." },
      },
    ]);
  });

  it("descarta ids duplicados antes de validar", () => {
    const result = validateBatch(
      [items[0], items[0]],
      EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
      "rest-c"
    );
    expect(result.valid).toHaveLength(1);
    expect(result.allOrNothing).toBe(true);
  });

  it("el motivo del rechazo nombra al equipo y su estado", () => {
    // El equipo está en otra unidad, así que el bloqueo real es su estado y no
    // un destino repetido.
    const result = validateBatch(
      [
        equipment({
          id: "z",
          assetCode: "Z-9",
          restaurantId: "rest-z",
          status: EQUIPMENT_STATUS.RETIRED,
        }),
      ],
      EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
      "rest-c"
    );
    expect(result.rejected[0].assetCode).toBe("Z-9");
    expect(result.rejected[0].check.error).toContain("Retirado");
  });
});

describe("summarizeBatch", () => {
  it("usa singular para un equipo", () => {
    expect(summarizeBatch(1, EQUIPMENT_MOVEMENT_TYPES.TRANSFER)).toBe(
      "1 equipo movido (traslado)."
    );
  });

  it("usa plural para varios", () => {
    expect(summarizeBatch(7, EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT)).toBe(
      "7 equipos movidos (préstamo)."
    );
  });
});

describe("suggestAssetCode", () => {
  it("usa el sufijo -C cuando está libre", () => {
    expect(suggestAssetCode("PH01-0001", new Set())).toBe("PH01-0001-C");
  });

  it("incrementa el sufijo hasta encontrar uno libre", () => {
    expect(
      suggestAssetCode("PH01-0001", new Set(["PH01-0001-C", "PH01-0001-C2"]))
    ).toBe("PH01-0001-C3");
  });
});

describe("eliminación segura", () => {
  it("permite borrar un equipo sin rastro", () => {
    const blockers = describeDeletionBlockers({
      label: 0,
      history: 0,
      movements: 0,
      requests: 0,
      origin: 0,
      replacedBy: 0,
    });
    expect(blockers).toEqual([]);
  });

  it("enumera cada bloqueo con su cantidad", () => {
    const blockers = describeDeletionBlockers({
      label: 1,
      history: 4,
      movements: 2,
      requests: 0,
      origin: 3,
      replacedBy: 0,
    });
    expect(blockers.map((b) => b.key)).toEqual([
      "label",
      "history",
      "movements",
      "origin",
    ]);
    expect(blockers.find((b) => b.key === "history")?.count).toBe(4);
  });

  it("el mensaje ofrece archivar en lugar de solo negar", () => {
    const message = deletionBlockedMessage([
      { key: "label", count: 1 },
      { key: "movements", count: 2 },
    ]);
    expect(message).toContain("1 etiqueta de seguridad emitida");
    expect(message).toContain("2 movimientos registrados");
    expect(message).toContain("Archívalo como retirado");
  });
});

describe("movementDescription", () => {
  it("describe origen y destino", () => {
    expect(
      movementDescription({
        type: EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
        fromName: "Pizza Hut 01",
        toName: "Denny's 03",
      })
    ).toBe("Traslado Pizza Hut 01 → Denny's 03.");
  });

  it("añade el equipo par y el motivo", () => {
    const text = movementDescription({
      type: EQUIPMENT_MOVEMENT_TYPES.COPY,
      fromName: "Pizza Hut 01",
      toName: "Pizza Hut 02",
      counterpartCode: "PH01-0001",
      reason: "Ampliación de sala",
    });
    expect(text).toContain("Copia");
    expect(text).toContain("Equipo par: PH01-0001.");
    expect(text).toContain("Motivo: Ampliación de sala.");
  });

  it("no inventa flechas cuando falta uno de los dos lados", () => {
    expect(
      movementDescription({ type: EQUIPMENT_MOVEMENT_TYPES.PULL, toName: "Central" })
    ).toBe("Jalado Destino: Central.");
  });
});
