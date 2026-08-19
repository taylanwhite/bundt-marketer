import { prisma } from './db.js';
import { isOrgAdmin } from './org-access.js';

/**
 * Check if user can mutate store data. Global admin or an explicit store permission.
 * Org admin without a store invite can view, not write.
 */
export async function canAccessStore(uid: string, storeId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { is_global_admin: true },
  });
  if (!user) return false;
  if (user.is_global_admin) return true;
  const perm = await prisma.storePermission.findUnique({
    where: { user_id_store_id: { user_id: uid, store_id: storeId } },
  });
  return !!perm;
}

/**
 * Check if user can read store data. Includes org admins for stores in their org.
 */
export async function canViewStore(uid: string, storeId: string): Promise<boolean> {
  if (await canAccessStore(uid, storeId)) return true;
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { organization_id: true },
  });
  if (!store?.organization_id) return false;
  return isOrgAdmin(uid, store.organization_id);
}

export type AccessibleStores = { all: true } | { ids: string[] };

export async function getAccessibleStores(uid: string): Promise<AccessibleStores> {
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { is_global_admin: true },
  });
  if (!user) return { ids: [] };
  if (user.is_global_admin) return { all: true };

  const [perms, adminOrgs] = await Promise.all([
    prisma.storePermission.findMany({
      where: { user_id: uid },
      select: { store_id: true },
    }),
    prisma.organizationMember.findMany({
      where: { user_id: uid, is_admin: true },
      select: { org_id: true },
    }),
  ]);

  const ids = new Set(perms.map((p) => p.store_id));
  if (adminOrgs.length > 0) {
    const orgStores = await prisma.store.findMany({
      where: { organization_id: { in: adminOrgs.map((o) => o.org_id) } },
      select: { id: true },
    });
    for (const store of orgStores) ids.add(store.id);
  }
  return { ids: [...ids] };
}

function queryFlag(value: unknown): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === '1' || raw === 'true';
}

/**
 * Resolve which stores a GET list may return.
 * `storeId` = one store. `orgId` = that org. `allStores` = every store the user can view.
 * Returns null when the request is missing a scope or not allowed.
 * Returns undefined store filter (unrestricted) only for global admins asking for all stores.
 */
export async function readableStoreScope(
  uid: string,
  query: { storeId?: string; orgId?: string; allStores?: unknown },
): Promise<{ unrestricted: true } | { storeIds: string[] } | null> {
  const storeId = query.storeId?.trim();
  const orgId = query.orgId?.trim();
  const allStores = queryFlag(query.allStores);

  if (!storeId && !orgId && !allStores) return null;

  const access = await getAccessibleStores(uid);

  if (storeId) {
    if ('all' in access || access.ids.includes(storeId)) return { storeIds: [storeId] };
    if (await canViewStore(uid, storeId)) return { storeIds: [storeId] };
    return null;
  }

  if (orgId) {
    if (!('all' in access) && !(await isOrgAdmin(uid, orgId))) return null;
    const orgStores = await prisma.store.findMany({
      where: { organization_id: orgId },
      select: { id: true },
    });
    const storeIds = orgStores
      .map((store) => store.id)
      .filter((id) => 'all' in access || access.ids.includes(id));
    return { storeIds };
  }

  if ('all' in access) return { unrestricted: true };
  return { storeIds: access.ids };
}

export function storeIdWhere(
  scope: { unrestricted: true } | { storeIds: string[] },
): { store_id?: string | { in: string[] } } {
  if ('unrestricted' in scope) return {};
  return { store_id: { in: scope.storeIds } };
}
