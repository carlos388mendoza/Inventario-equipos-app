import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { userTable } from "@/lib/db/schema/auth";
import {
  EQUIPMENT_STATUS,
  REQUEST_PRIORITY,
  REQUEST_STATUS,
  type EquipmentStatus,
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
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("equipment_asset_code_unique").on(table.assetCode),
    index("equipment_restaurant_idx").on(table.restaurantId),
    index("equipment_type_idx").on(table.equipmentTypeId),
    index("equipment_status_idx").on(table.status),
    index("equipment_serial_idx").on(table.serialNumber),
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
  equipment: many(equipment),
  requests: many(equipmentRequests),
  equipmentHistory: many(equipmentHistory),
  users: many(userTable),
}));

export const equipmentTypesRelations = relations(
  equipmentTypes,
  ({ many }) => ({
    equipment: many(equipment),
    requests: many(equipmentRequests),
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
  }),
  requests: many(equipmentRequests),
  history: many(equipmentHistory),
  label: one(securityLabels),
}));

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

export const securityLabelsRelations = relations(securityLabels, ({ one }) => ({
  equipment: one(equipment, {
    fields: [securityLabels.equipmentId],
    references: [equipment.id],
  }),
}));