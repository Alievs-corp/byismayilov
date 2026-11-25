export function visibleCategoryIds(
  rows: { id: string; parentId: string | null; isActive: boolean }[],
): Set<string> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const visible = new Set<string>();
  for (const row of rows) {
    if (!row.isActive) continue;
    const parent = row.parentId ? byId.get(row.parentId) : null;
    if (row.parentId && !parent?.isActive) continue;
    visible.add(row.id);
  }
  return visible;
}
