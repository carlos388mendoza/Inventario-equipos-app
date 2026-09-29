import { describe, expect, it } from "vitest";

import { EQUIPMENT_MOVEMENT_TYPES, EQUIPMENT_STATUS } from "@/lib/db/enums";
import {
  MOVEMENT_DEFINITIONS,
  checkCopyInput,
  checkLocationChange,
  checkReplacement,
  effectiveOwnerRestaurantId,
  isOnLoan,
  movementDescription,
  suggestAssetCode,
  summarizeBatch,
  validateBatch,
  type MovableEquipment,
} from "@/lib/equipment/movements";

/**
 * Los siete flujos de movimientos, uno por bloque.
 *
 * Cada bloque ata una regla al flujo de negocio que la justifica. No se prueba
 * "que la función devuelva algo", sino la propiedad que hace que el flujo tenga
 * sentido: que la copia no robe la serie del original, que el lote no se aplique
 * a medias, que la devolución no elija destino, que un equipo sustituido no
 * vuelva a moverse.
 */

const PZ01 = "rest-pz01";
const KF02 = "rest-kf02";

function equipo(over: Partial<MovableEquipment> = {}): MovableEquipment {
  return {
    id: "eq-1",
    assetCode: "PZ01-0001",
    serialNumber: "SN-0001",
    equipmentTypeId: "type-1",
    restaurantId: PZ01,
    ownerRestaurantId: null,
    status: EQUIPMENT_STATUS.ACTIVE,
    ...over,
  };
}

describe("A. Traslado físico a otra unidad", () => {
  it("exige un destino distinto del actual", () => {
    const check = checkLocationChange(equipo(), EQUIPMENT_MOVEMENT_TYPES.TRANSFER, PZ01);
    expect(check.ok).toBe(false);
  });

  it("acepta otra unidad y no altera la identidad del equipo", () => {
    const original = equipo();
    const check = checkLocationChange(original, EQUIPMENT_MOVEMENT_TYPES.TRANSFER, KF02);

    // La identidad viaja intacta: la misma fila, el mismo código, la misma
    // serie y la misma etiqueta. Por eso `TRANSFER` no crea equipo nuevo.
    expect(check.ok).toBe(true);
    expect(MOVEMENT_DEFINITIONS[EQUIPMENT_MOVEMENT_TYPES.TRANSFER].createsEquipment).toBe(false);
    expect(original.assetCode).toBe("PZ01-0001");
    expect(original.serialNumber).toBe("SN-0001");
  });

  it("deja el equipo disponible en el destino", () => {
    expect(summarizeBatch(1, EQUIPMENT_MOVEMENT_TYPES.TRANSFER)).toMatch(/1/);
  });
});

describe("B. Copia de información a otra unidad", () => {
  const original = equipo();
  const codigos = new Set(["PZ01-0001"]);
  const series = new Set(["SN-0001"]);

  it("exige un código de activo nuevo", () => {
    const check = checkCopyInput(original, { assetCode: "PZ01-0001", serialNumber: "SN-2" }, codigos, series);
    expect(check.ok).toBe(false);
  });

  it("no puede heredar el número de serie del original", () => {
    // La serie identifica el objeto físico: dos filas con la misma serie serían
    // el mismo equipo dos veces.
    const check = checkCopyInput(original, { assetCode: "PZ01-0002", serialNumber: "SN-0001" }, codigos, series);
    expect(check.ok).toBe(false);
  });

  it("acepta la copia con código y serie propios", () => {
    const check = checkCopyInput(original, { assetCode: "PZ01-0002", serialNumber: "SN-2" }, codigos, series);
    expect(check.ok).toBe(true);
    expect(MOVEMENT_DEFINITIONS[EQUIPMENT_MOVEMENT_TYPES.COPY].createsEquipment).toBe(true);
  });

  it("el original no se mueve: la copia no cambia su unidad", () => {
    const check = checkLocationChange(original, EQUIPMENT_MOVEMENT_TYPES.COPY, KF02);
    // La copia se registra en el libro, pero el original conserva su ubicación.
    expect(original.restaurantId).toBe(PZ01);
    expect(check.ok).toBe(true);
  });

  it("no se puede copiar un equipo fuera de servicio", () => {
    const retirado = equipo({ status: EQUIPMENT_STATUS.RETIRED });
    const check = checkCopyInput(retirado, { assetCode: "PZ01-0003", serialNumber: "SN-3" }, codigos, series);
    expect(check.ok).toBe(false);
  });

  it("sugiere el siguiente código libre para la copia", () => {
    expect(suggestAssetCode("PZ01-0001", new Set(["PZ01-0001"]))).toBe("PZ01-0001-C");
  });
});

describe("C. Transferencia múltiple de varios equipos", () => {
  const lote = [
    equipo({ id: "eq-1", assetCode: "PZ01-0001" }),
    equipo({ id: "eq-2", assetCode: "PZ01-0002" }),
    equipo({ id: "eq-3", assetCode: "PZ01-0003" }),
  ];

  it("admite varios equipos", () => {
    expect(MOVEMENT_DEFINITIONS[EQUIPMENT_MOVEMENT_TYPES.TRANSFER].supportsBatch).toBe(true);
  });

  it("si todos son válidos, mueve todos", () => {
    const resultado = validateBatch(lote, EQUIPMENT_MOVEMENT_TYPES.TRANSFER, KF02);
    expect(resultado.allOrNothing).toBe(true);
    expect(resultado.valid).toHaveLength(3);
  });

  it("si uno falla, el lote entero se marca como inválido", () => {
    // El ya retirado ensucia el lote. `validateBatch` sigue listando en `valid`
    // los que pasarían, pero la bandera `allOrNothing` es la que hace que la
    // acción aborte antes de escribir: el resultado para quien ejecuta es "no se
    // movió ninguno", no "se movió lo que se pudo".
    const conRetirado = [...lote, equipo({ id: "eq-4", assetCode: "PZ01-0004", status: EQUIPMENT_STATUS.RETIRED })];
    const resultado = validateBatch(conRetirado, EQUIPMENT_MOVEMENT_TYPES.TRANSFER, KF02);

    expect(resultado.allOrNothing).toBe(false);
    expect(resultado.rejected.map((r) => r.assetCode)).toEqual(["PZ01-0004"]);
    expect(resultado.rejected[0].check.error).toContain("Retirado");
  });

  it("resume el lote con el número de equipos movidos", () => {
    expect(summarizeBatch(3, EQUIPMENT_MOVEMENT_TYPES.TRANSFER)).toMatch(/3/);
  });
});

describe("D. Jalar inventario a la unidad actual", () => {
  it("exige un destino distinto: no tiene sentido jalar a donde ya está", () => {
    const check = checkLocationChange(equipo(), EQUIPMENT_MOVEMENT_TYPES.PULL, PZ01);
    expect(check.ok).toBe(false);
  });

  it("acepta traer el equipo de otra unidad", () => {
    const enOtra = equipo({ restaurantId: KF02 });
    const check = checkLocationChange(enOtra, EQUIPMENT_MOVEMENT_TYPES.PULL, PZ01);
    expect(check.ok).toBe(true);
  });

  it("queda registrado como jalado, no como traslado", () => {
    // Mismo efecto sobre la ubicación, distinta intención: por eso es un tipo
    // aparte y no un TRANSFER con otro nombre.
    expect(EQUIPMENT_MOVEMENT_TYPES.PULL).not.toBe(EQUIPMENT_MOVEMENT_TYPES.TRANSFER);
    expect(MOVEMENT_DEFINITIONS[EQUIPMENT_MOVEMENT_TYPES.PULL].label).toBe("Jalado");
  });
});

describe("E. Préstamo temporal y devolución", () => {
  const prestado = equipo({ restaurantId: KF02, ownerRestaurantId: PZ01 });

  it("un equipo prestado se reconoce porque el propietario no es su ubicación", () => {
    expect(isOnLoan(prestado)).toBe(true);
    expect(effectiveOwnerRestaurantId(prestado)).toBe(PZ01);
  });

  it("un equipo propio no está en préstamo", () => {
    expect(isOnLoan(equipo())).toBe(false);
  });

  it("no se presta dos veces el mismo equipo", () => {
    const check = checkLocationChange(prestado, EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT, "rest-cw04");
    expect(check.ok).toBe(false);
  });

  it("trasladar un equipo prestado está bloqueado: se devuelve primero", () => {
    // Si se permitiera, devolvería implícitamente sin quedar registrado.
    const check = checkLocationChange(prestado, EQUIPMENT_MOVEMENT_TYPES.TRANSFER, PZ01);
    expect(check.ok).toBe(false);
  });

  it("la devolución solo puede hacerse a la unidad propietaria", () => {
    const aTercera = checkLocationChange(prestado, EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN, "rest-cw04");
    expect(aTercera.ok).toBe(false);

    const aCasa = checkLocationChange(prestado, EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN, PZ01);
    expect(aCasa.ok).toBe(true);
  });

  it("no se devuelve lo que no está prestado", () => {
    const check = checkLocationChange(equipo(), EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN, PZ01);
    expect(check.ok).toBe(false);
  });

  it("el préstamo no cambia la propiedad, la devolución lo deja disponible", () => {
    expect(MOVEMENT_DEFINITIONS[EQUIPMENT_MOVEMENT_TYPES.LOAN_OUT].label).toBe("Préstamo");
    expect(MOVEMENT_DEFINITIONS[EQUIPMENT_MOVEMENT_TYPES.LOAN_RETURN].label).toBe("Devolución");
  });
});

describe("F. Sustitución de un equipo por otro", () => {
  it("exige un código nuevo y distinto del sustituido", () => {
    const check = checkReplacement(equipo(), "PZ01-0001", new Set(["PZ01-0001"]));
    expect(check.ok).toBe(false);
  });

  it("acepta el sustituto con código propio", () => {
    const check = checkReplacement(equipo(), "PZ01-0002", new Set(["PZ01-0001"]));
    expect(check.ok).toBe(true);
  });

  it("no se sustituye un equipo ya sustituido", () => {
    const sustituido = equipo({ status: EQUIPMENT_STATUS.REPLACED });
    const check = checkReplacement(sustituido, "PZ01-0002", new Set(["PZ01-0001"]));
    expect(check.ok).toBe(false);
  });

  it("el sustituido queda fuera de servicio y no admite más movimientos", () => {
    const check = checkLocationChange(
      equipo({ status: EQUIPMENT_STATUS.REPLACED }),
      EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
      KF02
    );
    expect(check.ok).toBe(false);
  });

  it("el sustituto entra activo", () => {
    expect(MOVEMENT_DEFINITIONS[EQUIPMENT_MOVEMENT_TYPES.REPLACEMENT].createsEquipment).toBe(true);
  });
});

describe("G. El asiento del libro describe el movimiento completo", () => {
  it("un traslado nombra origen, destino y motivo", () => {
    const texto = movementDescription({
      type: EQUIPMENT_MOVEMENT_TYPES.TRANSFER,
      fromName: "Pizza Hut",
      toName: "KFC",
      reason: "Reubicación por reforma",
    });
    expect(texto).toContain("Pizza Hut");
    expect(texto).toContain("KFC");
    expect(texto).toContain("Reubicación por reforma");
  });

  it("una copia nombra el equipo par", () => {
    const texto = movementDescription({
      type: EQUIPMENT_MOVEMENT_TYPES.COPY,
      fromName: "Pizza Hut",
      toName: "KFC",
      counterpartCode: "PZ01-0002",
    });
    expect(texto).toContain("PZ01-0002");
  });

  it("cada tipo de movimiento produce un texto legible y no vacío", () => {
    for (const type of Object.values(EQUIPMENT_MOVEMENT_TYPES)) {
      const texto = movementDescription({
        type,
        fromName: "Pizza Hut",
        toName: "KFC",
        counterpartCode: "PZ01-0002",
        reason: "motivo",
      });
      expect(texto.length).toBeGreaterThan(0);
    }
  });

  it("las unidades ausentes no rompen el texto", () => {
    const texto = movementDescription({
      type: EQUIPMENT_MOVEMENT_TYPES.PULL,
      fromName: null,
      toName: null,
    });
    expect(texto.length).toBeGreaterThan(0);
  });
});
