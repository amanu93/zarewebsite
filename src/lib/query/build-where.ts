import type { Where } from "@/lib/query/types";

export type SearchableColumn =
  | string
  | Array<{
      label: string;
      value: string; // actual column name used by backend
    }>;

export type SelectedFilter = {
  label: string; // UI label like "Status"
  field: string; // backend column like "status"
  operator: "=" | "ILIKE" | "IN" | ">=" | "<=" | "LIKE";
  value: unknown;
  filterLabel?: string; // UI label like "Active"
};

type BuildWhereParams = {
  primaryColumn: SearchableColumn;
  search: string;
  selectedFilters: SelectedFilter[];
};

export function buildWhere({
  primaryColumn,
  search,
  selectedFilters,
}: BuildWhereParams): Where[][] {
  const where: Where[][] = [];

  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    // Add wildcards for partial matching with ILIKE
    const searchValue = `%${trimmedSearch}%`;
    if (typeof primaryColumn === "string") {
      // Search on a single column
      where.push([
        {
          column: primaryColumn,
          operator: "ILIKE",
          value: searchValue,
        },
      ]);
    } else if (Array.isArray(primaryColumn)) {
      // Search across multiple columns (OR group)
      where.push(
        primaryColumn.map((col) => ({
          column: col.value,
          operator: "ILIKE",
          value: searchValue,
        }))
      );
    }
  }

  if (selectedFilters.length > 0) {
    // Each filter becomes its own AND group
    for (const filter of selectedFilters) {
      where.push([
        {
          column: filter.field,
          operator: filter.operator,
          value: filter.value,
        },
      ]);
    }
  }

  return where;
}
