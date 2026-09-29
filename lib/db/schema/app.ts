import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { userTable } from "@/lib/db/schema/auth";
import {
  EQUIPMENT_STATUS,
  INVENTORY_FORMAT,
  REQUEST_PRIORITY,
  REQUEST_STATUS,
  type EquipmentMovementType,
  type EquipmentStatus,
  type InventoryFormat,
  type RequestPriority,
  type RequestStatus,
} from "@/lib/db/enums";

/** Mesa/restaurante o unidad de negocio. */
export const restaurants = sqliteTable(
  "restaurants",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    address: text("address"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    /** Marca que representa (ej. "China Wok", "Pizza Hut"). */
    brand: text("brand"),
    /** Sector de la unidad (ej. "Restaurantes"). */
    sector: text("sector"),
    /** URL o ruta del logo (local en /public/brands o URL externa). */
    logo: text("logo"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("restaurants_code_unique").on(table.code)]
);

/** Tipo de equipo (catalogable): televisión, HME, impresoras, etc. */
export const equipmentTypes = sqliteTable(
  "equipment_types",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    usefulLifeMonths: integer("useful_life_months").notNull().default(36),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("equipment_types_name_idx").on(table.name)]
);

/** Equipo físico concreto asignado a un restaurante. */
export const equipment = sqliteTable(
  "equipment",
  {
    id: text("id").primaryKey(),
    assetCode: text("asset_code").notNull(),
    serialNumber: text("serial_number"),
    equipmentTypeId: text("equipment_type_id")
      .notNull()
      .references(() => equipmentTypes.id),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    brand: text("brand"),
    model: text("model"),
    purchaseDate: integer("purchase_date", { mode: "timestamp_ms" }),
    installationDate: integer("installation_date", { mode: "timestamp_ms" }),
    status: text("status")
      .$type<EquipmentStatus>()
      .notNull()
      .default(EQUIPMENT_STATUS.ACTIVE),
    notes: text("notes"),
    // ─── Trazabilidad al documento de inventario de origen ───────────────
    // Estas columnas guardan el dato EXACTO del documento. No se derivan ni se
    // corrigen: el código corto puede venir repetido en el original y la
    // FECHA puede venir en notación científica, así que se conserva tal cual.
    /** Documento de origen, p. ej. "INVENTARIO PH01.xlsx". */
    sourceDocument: text("source_document"),
    /** DESCRIPCION del documento (código corto). NO es único: el original lo repite. */
    sourceShortCode: text("source_short_code"),
    /** DESCRIPCION LARGA del documento. */
    sourceDescription: text("source_description"),
    /** CODIGOQR del documento original. No es el token de la etiqueta propia. */
    sourceQrCode: text("source_qr_code"),
    /** TECNICO_APERTURA del documento. */
    sourceTechnician: text("source_technician"),
    /** FECHA del documento tal cual aparece, sin interpretar ni reformatear. */
    sourceDateText: text("source_date_text"),
    // ─── Movimientos de inventario ──────────────────────────────────────────
    /**
     * Propietario del equipo, que NO siempre coincide con su ubicación actual.
     *
     * `restaurantId` es DÓNDE está el equipo ahora. `ownerRestaurantId` es de
     * QUIÉN es, y solo se separa de `restaurantId` mientras hay un préstamo
     * vigente: un equipo prestado sigue perteneciendo a su unidad original.
     *
     * NULL significa "el propietario es la unidad donde está", que es el caso
     * normal. La regla derivada es:
     *   `ownerRestaurantId != null && ownerRestaurantId != restaurantId`
     *   ⟺ el equipo está en préstamo.
     *
     * Solo la devolución vuelve a ponerlo en NULL.
     */
    ownerRestaurantId: text("owner_restaurant_id").references(
      () => restaurants.id
    ),
    /**
     * Equipo del que se creó una COPIA. NULL en el equipo original y en los
     * equipos que novenance de una copia. Es una comodidad de lectura: el
     * linaje completo y auditable está en `equipment_movements`.
     */
    originEquipmentId: text("origin_equipment_id").references(
      (): AnySQLiteColumn => equipment.id
    ),
    /**
     * Equipo que SUSTITUYÓ a este. Queda fijado al hacer una sustitución y es
     * la señal de que este equipo quedó fuera de servicio. La flecha inversa
     * ("a quién sustituyó") se obtiene consultando `equipment_movements`.
     */
    replacedByEquipmentId: text("replaced_by_equipment_id").references(
      (): AnySQLiteColumn => equipment.id
    ),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("equipment_asset_code_unique").on(table.assetCode),
    index("equipment_restaurant_idx").on(table.restaurantId),
    index("equipment_owner_restaurant_idx").on(table.ownerRestaurantId),
    index("equipment_origin_idx").on(table.originEquipmentId),
    index("equipment_replaced_by_idx").on(table.replacedByEquipmentId),
    index("equipment_type_idx").on(table.equipmentTypeId),
    index("equipment_status_idx").on(table.status),
    index("equipment_serial_idx").on(table.serialNumber),
    index("equipment_source_document_idx").on(table.sourceDocument),
  ]
);

/**
 * Inventario agregado por rubro (formato DNS19.xlsx de Denny's).
 *
 * Es una representación distinta de `equipment` a propósito: una fila de este
 * tipo cubre N unidades idénticas de un rubro y no identifica un equipo
 * individual, por lo que no puede tener etiqueta, QR ni solicitud asociada.
 * Mezclarla en `equipment` obligaría a duplicar filas y perdería el valor del
 * documento.
 *
 * `totalValue` es el valor de la LÍNEA tal como viene en el documento (columna
 * VALOR), no el precio unitario: en DNS19.xlsx la suma de VALOR coincide
 * exactamente con el TOTAL del documento. Se guarda en centavos para no
 * arrastrar errores de coma flotante.
 */
export const equipmentGroups = sqliteTable(
  "equipment_groups",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    /** Formato del documento del que proviene la fila. */
    sourceFormat: text("source_format")
      .$type<InventoryFormat>()
      .notNull()
      .default(INVENTORY_FORMAT.AGGREGATE),
    /** EQUIPO del documento, verbatim. */
    name: text("name").notNull(),
    /** CANT del documento. */
    quantity: integer("quantity").notNull().default(1),
    /** VALOR del documento: total de la línea, en centavos. */
    totalValue: integer("total_value"),
    /** Moneda tal como aparece en el documento (p. ej. "L"). */
    currency: text("currency"),
    /** Clave de la línea dentro del documento, si el documento la define. */
    sourceLineCode: text("source_line_code"),
    /** Documento de origen, p. ej. "DNS19.xlsx". */
    sourceDocument: text("source_document"),
    notes: text("notes"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("equipment_groups_restaurant_idx").on(table.restaurantId),
    index("equipment_groups_source_document_idx").on(table.sourceDocument),
  ]
);

/** Solicitud de equipo nuevo o de reemplazo. */
export const equipmentRequests = sqliteTable(
  "equipment_requests",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => userTable.id),
    equipmentTypeId: text("equipment_type_id")
      .notNull()
      .references(() => equipmentTypes.id),
    /** Nullable: NULL indica que se solicita un equipo NUEVO. */
    currentEquipmentId: text("current_equipment_id").references(
      () => equipment.id
    ),
    reason: text("reason").notNull(),
    description: text("description"),
    priority: text("priority")
      .$type<RequestPriority>()
      .notNull()
      .default(REQUEST_PRIORITY.NORMAL),
    status: text("status")
      .$type<RequestStatus>()
      .notNull()
      .default(REQUEST_STATUS.PENDING),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("requests_restaurant_idx").on(table.restaurantId),
    index("requests_requested_by_idx").on(table.requestedBy),
    index("requests_type_idx").on(table.equipmentTypeId),
    index("requests_status_idx").on(table.status),
    index("requests_priority_idx").on(table.priority),
    index("requests_created_at_idx").on(table.createdAt),
  ]
);

/** Historial de cambios de estado de las solicitudes. */
export const requestHistory = sqliteTable(
  "request_history",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => equipmentRequests.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => userTable.id),
    oldStatus: text("old_status").$type<RequestStatus>(),
    newStatus: text("new_status").$type<RequestStatus>().notNull(),
    comment: text("comment"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("request_history_request_idx").on(table.requestId),
    index("request_history_user_idx").on(table.userId),
    index("request_history_created_at_idx").on(table.createdAt),
  ]
);

/** Historial de eventos de un equipo durante su vida útil. */
export const equipmentHistory = sqliteTable(
  "equipment_history",
  {
    id: text("id").primaryKey(),
    equipmentId: text("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    restaurantId: text("restaurant_id").references(() => restaurants.id),
    action: text("action").notNull(),
    description: text("description"),
    performedBy: text("performed_by").references(() => userTable.id),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("equipment_history_equipment_idx").on(table.equipmentId),
    index("equipment_history_restaurant_idx").on(table.restaurantId),
    index("equipment_history_created_at_idx").on(table.createdAt),
  ]
);

/**
 * Libro de movimientos de inventario: traslado, copia, jalado, préstamo,
 * devolución y sustitución.
 *
 * Es la fuente de verdad del módulo de Movimientos y responde a una pregunta
 * que `equipment_history` no puede contestar por sí sola: no guarda el equipo
 * al que se movió ni el motivo, y su `action` es texto libre.
 *
 * Diferencias deliberadas respecto a `equipment_history`:
 *
 * - `batchId` agrupa los movimientos de una misma operación múltiple, de modo
 *   que "moví 12 equipos a la vez" es una sola entrada consultable. Un
 *   movimiento simple también lleva `batchId`: es su propio lote de uno.
 * - `type` es un conjunto cerrado (`EquipmentMovementType`), no texto libre.
 * - Guarda `assetCode` desnormalizado para que el libro siga siendo legible si
 *   el código del equipo cambia o si la fila se elimina.
 * - `fromRestaurantId` y `toRestaurantId` son AMBOS opcionales porque las
 *   operaciones difieren: un traslado tiene ambos, un préstamo tiene ambos, y
 *   una devolución tiene `from` = quien devuelve y `to` = el propietario.
 *
 * `equipmentId` y `counterpartEquipmentId` NO tienen `onDelete: cascade` a
 * propósito: el libro es auditoría y debe sobrevivir a la eliminación de un
 * equipo. Las acciones de eliminación de movimientos comprueban estas referencias
 * y bloquean el borrado en lugar de arrastrar el historial.
 */
export const equipmentMovements = sqliteTable(
  "equipment_movements",
  {
    id: text("id").primaryKey(),
    /** Agrupa una operación. Un movimiento simple genera un lote de un elemento. */
    batchId: text("batch_id").notNull(),
    type: text("type").$type<EquipmentMovementType>().notNull(),
    /** Equipo movido. */
    equipmentId: text("equipment_id")
      .notNull()
      .references(() => equipment.id),
    /** Equipo par: el origen en una COPIA, el sustituto en una SUSTITUCIÓN. */
    counterpartEquipmentId: text("counterpart_equipment_id").references(
      () => equipment.id
    ),
    fromRestaurantId: text("from_restaurant_id").references(() => restaurants.id),
    toRestaurantId: text("to_restaurant_id").references(() => restaurants.id),
    /** Código de activo en el momento del movimiento. */
    assetCode: text("asset_code").notNull(),
    /** Tipo de equipo en el momento del movimiento, para leer el libro sin join. */
    equipmentTypeId: text("equipment_type_id").references(() => equipmentTypes.id),
    /** Motivo elegido por el usuario. */
    reason: text("reason"),
    /** Detalle libre. */
    notes: text("notes"),
    performedBy: text("performed_by").references(() => userTable.id),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("equipment_movements_batch_idx").on(table.batchId),
    index("equipment_movements_equipment_idx").on(table.equipmentId),
    index("equipment_movements_counterpart_idx").on(table.counterpartEquipmentId),
    index("equipment_movements_type_idx").on(table.type),
    index("equipment_movements_from_idx").on(table.fromRestaurantId),
    index("equipment_movements_to_idx").on(table.toRestaurantId),
    index("equipment_movements_created_at_idx").on(table.createdAt),
  ]
);

/**
 * Etiqueta de seguridad vinculada a un equipo.
 * El token es un identificador opaco y aleatorio que protege la URL pública
 * del QR: el QR no contiene información sensible.
 */
export const securityLabels = sqliteTable(
  "security_labels",
  {
    id: text("id").primaryKey(),
    equipmentId: text("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("security_labels_token_unique").on(table.token),
    uniqueIndex("security_labels_equipment_unique").on(table.equipmentId),
  ]
);

// ─── Relaciones ─────────────────────────────────────────────────────────────

export const restaurantsRelations = relations(restaurants, ({ many }) => ({
  equipment: many(equipment, { relationName: "equipment_restaurant" }),
  equipmentGroups: many(equipmentGroups),
  requests: many(equipmentRequests),
  equipmentHistory: many(equipmentHistory),
  users: many(userTable),
  ownedEquipment: many(equipment, { relationName: "equipment_owner" }),
  equipmentMovementsFrom: many(equipmentMovements, {
    relationName: "movement_from",
  }),
  equipmentMovementsTo: many(equipmentMovements, {
    relationName: "movement_to",
  }),
}));

export const equipmentTypesRelations = relations(
  equipmentTypes,
  ({ many }) => ({
    equipment: many(equipment),
    requests: many(equipmentRequests),
    movements: many(equipmentMovements),
  })
);

export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  type: one(equipmentTypes, {
    fields: [equipment.equipmentTypeId],
    references: [equipmentTypes.id],
  }),
  restaurant: one(restaurants, {
    fields: [equipment.restaurantId],
    references: [restaurants.id],
    relationName: "equipment_restaurant",
  }),
  /** Dueño real, distinto de `restaurant` mientras hay un préstamo vigente. */
  ownerRestaurant: one(restaurants, {
    fields: [equipment.ownerRestaurantId],
    references: [restaurants.id],
    relationName: "equipment_owner",
  }),
  /** Equipo del que se creó esta copia. */
  originEquipment: one(equipment, {
    fields: [equipment.originEquipmentId],
    references: [equipment.id],
    relationName: "equipment_origin",
  }),
  /** Equipo que sustituyó a este. */
  replacedByEquipment: one(equipment, {
    fields: [equipment.replacedByEquipmentId],
    references: [equipment.id],
    relationName: "equipment_replaced_by",
  }),
  requests: many(equipmentRequests),
  history: many(equipmentHistory),
  movements: many(equipmentMovements, { relationName: "movement_equipment" }),
  label: one(securityLabels),
}));

export const equipmentGroupsRelations = relations(
  equipmentGroups,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [equipmentGroups.restaurantId],
      references: [restaurants.id],
    }),
  })
);

export const equipmentRequestsRelations = relations(
  equipmentRequests,
  ({ one, many }) => ({
    restaurant: one(restaurants, {
      fields: [equipmentRequests.restaurantId],
      references: [restaurants.id],
    }),
    requestedByUser: one(userTable, {
      fields: [equipmentRequests.requestedBy],
      references: [userTable.id],
    }),
    equipmentType: one(equipmentTypes, {
      fields: [equipmentRequests.equipmentTypeId],
      references: [equipmentTypes.id],
    }),
    currentEquipment: one(equipment, {
      fields: [equipmentRequests.currentEquipmentId],
      references: [equipment.id],
    }),
    history: many(requestHistory),
  })
);

export const requestHistoryRelations = relations(requestHistory, ({ one }) => ({
  request: one(equipmentRequests, {
    fields: [requestHistory.requestId],
    references: [equipmentRequests.id],
  }),
  user: one(userTable, {
    fields: [requestHistory.userId],
    references: [userTable.id],
  }),
}));

export const equipmentHistoryRelations = relations(
  equipmentHistory,
  ({ one }) => ({
    equipment: one(equipment, {
      fields: [equipmentHistory.equipmentId],
      references: [equipment.id],
    }),
    restaurant: one(restaurants, {
      fields: [equipmentHistory.restaurantId],
      references: [restaurants.id],
    }),
    performedByUser: one(userTable, {
      fields: [equipmentHistory.performedBy],
      references: [userTable.id],
    }),
  })
);

export const equipmentMovementsRelations = relations(
  equipmentMovements,
  ({ one }) => ({
    equipment: one(equipment, {
      fields: [equipmentMovements.equipmentId],
      references: [equipment.id],
      relationName: "movement_equipment",
    }),
    counterpartEquipment: one(equipment, {
      fields: [equipmentMovements.counterpartEquipmentId],
      references: [equipment.id],
      relationName: "movement_counterpart",
    }),
    fromRestaurant: one(restaurants, {
      fields: [equipmentMovements.fromRestaurantId],
      references: [restaurants.id],
      relationName: "movement_from",
    }),
    toRestaurant: one(restaurants, {
      fields: [equipmentMovements.toRestaurantId],
      references: [restaurants.id],
      relationName: "movement_to",
    }),
    equipmentType: one(equipmentTypes, {
      fields: [equipmentMovements.equipmentTypeId],
      references: [equipmentTypes.id],
    }),
    performer: one(userTable, {
      fields: [equipmentMovements.performedBy],
      references: [userTable.id],
    }),
  })
);

export const securityLabelsRelations = relations(securityLabels, ({ one }) => ({
  equipment: one(equipment, {
    fields: [securityLabels.equipmentId],
    references: [equipment.id],
  }),
}));

export const userRelations = relations(userTable, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [userTable.restaurantId],
    references: [restaurants.id],
  }),
  requests: many(equipmentRequests),
  requestHistory: many(requestHistory),
  equipmentHistory: many(equipmentHistory),
}));