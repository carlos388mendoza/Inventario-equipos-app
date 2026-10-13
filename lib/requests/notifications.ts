import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentRequests,
  equipmentTypes,
  requestConfirmationTokens,
  requestNotifications,
  restaurants,
  userTable,
} from "@/lib/db/schema";
import {
  DESTINATION_AREA_LABELS,
  INSTALLATION_FOLLOW_UP_DAYS,
  ONE_SHOT_NOTIFICATION_TYPES,
  REQUEST_NOTIFICATION_STATUS,
  REQUEST_NOTIFICATION_TYPE,
  ROLES,
  type DestinationArea,
  type RequestNotificationType,
} from "@/lib/db/enums";
import {
  configuredApproverEmails,
  sendEmail,
} from "@/lib/email/send";
import { appBaseUrl } from "@/lib/utils";

export interface RequestContext {
  id: string;
  restaurantId: string;
  restaurantName: string;
  equipmentTypeName: string;
  requestedById: string;
  requestedByName: string;
  reason: string;
  destinationArea: DestinationArea | null;
  currentEquipmentAssetCode: string | null;
}

/** Datos necesarios para redactar una notificación de una solicitud. */
export async function loadRequestContext(
  requestId: string
): Promise<RequestContext | null> {
  const [row] = await db
    .select({
      id: equipmentRequests.id,
      restaurantId: equipmentRequests.restaurantId,
      restaurantName: restaurants.name,
      equipmentTypeName: equipmentTypes.name,
      requestedById: equipmentRequests.requestedBy,
      requestedByName: userTable.name,
      reason: equipmentRequests.reason,
      destinationArea: equipmentRequests.destinationArea,
      currentEquipmentAssetCode: equipment.assetCode,
    })
    .from(equipmentRequests)
    .innerJoin(restaurants, eq(equipmentRequests.restaurantId, restaurants.id))
    .innerJoin(userTable, eq(equipmentRequests.requestedBy, userTable.id))
    .innerJoin(
      equipmentTypes,
      eq(equipmentRequests.equipmentTypeId, equipmentTypes.id)
    )
    .leftJoin(equipment, eq(equipmentRequests.currentEquipmentId, equipment.id))
    .where(eq(equipmentRequests.id, requestId));

  if (!row) return null;
  return {
    ...row,
    destinationArea: row.destinationArea ?? null,
    currentEquipmentAssetCode: row.currentEquipmentAssetCode ?? null,
  };
}

/** Correo de un usuario concreto (para avisarle del resultado). */
export async function getUserEmail(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, userId));
  return row?.email ?? null;
}

/**
 * Destinatarios de aprobación: la lista configurada (Damaris y quien
 * corresponda); si no hay ninguna, los ADMIN activos.
 */
export async function getApproverRecipients(): Promise<string[]> {
  const configured = configuredApproverEmails();
  if (configured.length > 0) return configured;

  const admins = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(and(eq(userTable.role, ROLES.ADMIN), eq(userTable.active, true)));
  return admins.map((a) => a.email);
}

/** Usuarios activos de la unidad (para avisar de aprobaciones y seguimientos). */
export async function getRestaurantRecipientEmails(
  restaurantId: string
): Promise<string[]> {
  const rows = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(
      and(
        eq(userTable.restaurantId, restaurantId),
        eq(userTable.role, ROLES.RESTAURANT_USER),
        eq(userTable.active, true)
      )
    );
  return rows.map((r) => r.email);
}

/**
 * Registra y envía notificaciones para una solicitud.
 *
 * Los tipos de un solo envío (`ONE_SHOT_NOTIFICATION_TYPES`) se saltan si ya
 * existe cualquier fila de ese tipo para la solicitud: así no se duplican
 * aunque la acción se reintente o el correo falle.
 */
export async function recordNotifications(input: {
  requestId: string;
  type: RequestNotificationType;
  recipients: string[];
  subject: string;
  body: string;
}): Promise<void> {
  const recipients = [...new Set(input.recipients.map((r) => r.toLowerCase()))].filter(Boolean);
  if (recipients.length === 0) return;

  if (ONE_SHOT_NOTIFICATION_TYPES.includes(input.type)) {
    const [existing] = await db
      .select({ id: requestNotifications.id })
      .from(requestNotifications)
      .where(
        and(
          eq(requestNotifications.requestId, input.requestId),
          eq(requestNotifications.type, input.type)
        )
      )
      .limit(1);
    if (existing) return;
  }

  for (const recipient of recipients) {
    const id = crypto.randomUUID();
    await db.insert(requestNotifications).values({
      id,
      requestId: input.requestId,
      type: input.type,
      recipient,
      subject: input.subject,
      body: input.body,
      status: REQUEST_NOTIFICATION_STATUS.PENDING,
      createdAt: new Date(),
    });

    const result = await sendEmail({
      to: recipient,
      subject: input.subject,
      text: input.body,
    });

    await db
      .update(requestNotifications)
      .set({
        status: result.status,
        provider: result.provider,
        error: result.error ?? null,
        sentAt: result.status === "SENT" ? new Date() : null,
      })
      .where(eq(requestNotifications.id, id));
  }
}

function areaLabel(area: DestinationArea | null): string {
  return area ? DESTINATION_AREA_LABELS[area] : "Sin especificar";
}

function equipmentLine(ctx: RequestContext): string {
  return ctx.currentEquipmentAssetCode
    ? `Reemplazo del equipo con código ${ctx.currentEquipmentAssetCode}`
    : "Equipo nuevo";
}

function summary(ctx: RequestContext): string {
  return [
    `Restaurante: ${ctx.restaurantName}`,
    `Equipo: ${ctx.equipmentTypeName}`,
    `Tipo: ${equipmentLine(ctx)}`,
    `Área de destino: ${areaLabel(ctx.destinationArea)}`,
    `Solicitado por: ${ctx.requestedByName}`,
    `Motivo: ${ctx.reason}`,
  ].join("\n");
}

/** Aviso a aprobadores de que se registró una solicitud. */
export async function notifyRequestCreated(ctx: RequestContext): Promise<void> {
  const recipients = await getApproverRecipients();
  const link = `${appBaseUrl()}/requests`;
  await recordNotifications({
    requestId: ctx.id,
    type: REQUEST_NOTIFICATION_TYPE.REQUEST_CREATED,
    recipients,
    subject: `Nueva solicitud de equipo — ${ctx.restaurantName}`,
    body: `Se registró una solicitud de equipo que requiere aprobación.\n\n${summary(
      ctx
    )}\n\nRevísala en: ${link}`,
  });
}

/** Aviso a la unidad (y al solicitante) del resultado de la aprobación. */
export async function notifyRequestDecision(
  ctx: RequestContext,
  decision: "APPROVED" | "REJECTED",
  comment?: string | null
): Promise<void> {
  const recipients = [
    ...(await getRestaurantRecipientEmails(ctx.restaurantId)),
  ];
  const requesterEmail = await getUserEmail(ctx.requestedById);
  if (requesterEmail) recipients.push(requesterEmail);

  const approved = decision === "APPROVED";
  const type = approved
    ? REQUEST_NOTIFICATION_TYPE.REQUEST_APPROVED
    : REQUEST_NOTIFICATION_TYPE.REQUEST_REJECTED;
  const title = approved
    ? "Tu solicitud de equipo fue aprobada"
    : "Tu solicitud de equipo fue rechazada";

  await recordNotifications({
    requestId: ctx.id,
    type,
    recipients,
    subject: `${title} — ${ctx.restaurantName}`,
    body: `${title}.\n\n${summary(ctx)}${
      comment ? `\n\nComentario: ${comment}` : ""
    }${
      approved
        ? "\n\nCuando instales el equipo recibirás un correo para confirmarlo."
        : ""
    }`,
  });
}

/** Correo de seguimiento de instalación (aprobación + N días). */
export async function sendInstallationFollowUp(
  ctx: RequestContext
): Promise<{ token: string; recipients: string[] }> {
  const token = crypto.randomUUID().replaceAll("-", "");
  const expiresAt = new Date(
    Date.now() + INSTALLATION_FOLLOW_UP_DAYS * 2 * 24 * 60 * 60 * 1000
  );
  await db.insert(requestConfirmationTokens).values({
    id: crypto.randomUUID(),
    requestId: ctx.id,
    token,
    purpose: "INSTALLATION_FOLLOWUP",
    expiresAt,
    createdAt: new Date(),
  });

  const recipients = [...(await getRestaurantRecipientEmails(ctx.restaurantId))];
  const requesterEmail = await getUserEmail(ctx.requestedById);
  if (requesterEmail) recipients.push(requesterEmail);

  const link = `${appBaseUrl()}/confirmar/${token}`;
  await recordNotifications({
    requestId: ctx.id,
    type: REQUEST_NOTIFICATION_TYPE.FOLLOW_UP,
    recipients,
    subject: `¿Ya se instaló el equipo? — ${ctx.restaurantName}`,
    body: `Ha pasado el plazo previsto y sigue pendiente confirmar la instalación.\n\n${summary(
      ctx
    )}\n\nConfirma o indica que AÚN NO se ha instalado en: ${link}`,
  });

  return { token, recipients };
}

/** Aviso a aprobadores y unidad del resultado de instalación. */
export async function notifyInstallationResult(
  ctx: RequestContext,
  confirmed: boolean
): Promise<void> {
  const recipients = [
    ...(await getApproverRecipients()),
    ...(await getRestaurantRecipientEmails(ctx.restaurantId)),
  ];
  const requesterEmail = await getUserEmail(ctx.requestedById);
  if (requesterEmail) recipients.push(requesterEmail);

  const type = confirmed
    ? REQUEST_NOTIFICATION_TYPE.INSTALLATION_CONFIRMED
    : REQUEST_NOTIFICATION_TYPE.INSTALLATION_NOT_INSTALLED;
  const title = confirmed
    ? `Instalación confirmada — ${ctx.restaurantName}`
    : `Instalación aún no realizada — ${ctx.restaurantName}`;

  await recordNotifications({
    requestId: ctx.id,
    type,
    recipients,
    subject: title,
    body: `${title}.\n\n${summary(ctx)}${
      confirmed
        ? "\n\nEl equipo ya puede incorporarse al inventario cuando corresponda."
        : "\n\nAlguien indicó que el equipo AÚN NO se ha instalado."
    }`,
  });
}

/** Correos activos de varios usuarios (helper para avisos puntuales). */
export async function getEmailsForUsers(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(inArray(userTable.id, userIds));
  return rows.map((r) => r.email);
}
