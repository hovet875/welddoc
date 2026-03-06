export type PageRequest = {
  page: number;
  pageSize: number;
};

export type PageResult<TItem> = {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
};

export function normalizePageRequest(input: Partial<PageRequest> | undefined, defaults?: Partial<PageRequest>): PageRequest {
  const fallbackPage = Number(defaults?.page ?? 1);
  const fallbackSize = Number(defaults?.pageSize ?? 50);

  const page = Number(input?.page ?? fallbackPage);
  const pageSize = Number(input?.pageSize ?? fallbackSize);

  return {
    page: Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.trunc(pageSize) : 50,
  };
}

export function getRangeFromPage(page: number, pageSize: number) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.trunc(pageSize) : 50;
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  return { from, to };
}