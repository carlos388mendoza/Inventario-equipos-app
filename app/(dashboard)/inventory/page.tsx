import { requireRole } from "@/lib/auth/session";
import { resolveScope } from "@/lib/equipment/scope";
import { ROLES } from "@/lib/db/enums";
import {
  countDocumentedEquipment,
  getInventory,
  getInventoryDocuments,
} from "@/lib/db/queries/inventory";
import { InventoryView } from "@/components/inventory/inventory-view";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const user = await requireRole(
    ROLES.ADMIN,
    ROLES.IT_MANAGER,
    ROLES.RESTAURANT_USER
  );
  const scope = await resolveScope();

  const [{ assets, groups }, documents, documented] = await Promise.all([
    getInventory(scope),
    getInventoryDocuments(scope),
    countDocumentedEquipment(scope),
  ]);

  return (
    <InventoryView
      assets={assets}
      groups={groups}
      documents={documents}
      documentedCount={documented}
      canSeeAll={scope.isGlobal}
      viewerName={user.name}
    />
  );
}
