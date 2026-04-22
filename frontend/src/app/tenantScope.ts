export const TENANT_ID_QUERY_PARAM = "tenantId";

export function normalizeTenantId(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

export function getTenantIdFromSearchParams(searchParams: URLSearchParams): string | null {
  return normalizeTenantId(searchParams.get(TENANT_ID_QUERY_PARAM));
}

export function withQueryParams(
  to: string,
  params: Record<string, string | null | undefined>,
): string {
  const url = new URL(to, "https://forgegate.local");

  Object.entries(params).forEach(([key, value]) => {
    const normalized = normalizeTenantId(value);
    if (normalized === null) {
      url.searchParams.delete(key);
      return;
    }
    url.searchParams.set(key, normalized);
  });

  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

export function withTenantScope(to: string, tenantId: string | null | undefined): string {
  return withQueryParams(to, { [TENANT_ID_QUERY_PARAM]: tenantId });
}
