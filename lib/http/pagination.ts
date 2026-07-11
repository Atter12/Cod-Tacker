export type PaginationInput = {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export function normalizePagination(
  pageRaw: number | undefined,
  pageSizeRaw: number | undefined,
  defaults: { pageSize?: number; maxPageSize?: number } = {},
): PaginationInput {
  const maxPageSize = defaults.maxPageSize ?? MAX_PAGE_SIZE;
  const defaultPageSize = defaults.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = Number.isFinite(pageRaw) && (pageRaw as number) > 0 ? Math.floor(pageRaw as number) : 1;
  const pageSize = Math.min(
    Math.max(
      Number.isFinite(pageSizeRaw) && (pageSizeRaw as number) > 0
        ? Math.floor(pageSizeRaw as number)
        : defaultPageSize,
      1,
    ),
    maxPageSize,
  );
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  };
}

export function toPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const safeTotal = Math.max(total, 0);
  return {
    data,
    total: safeTotal,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(safeTotal / pageSize) || 1),
  };
}
