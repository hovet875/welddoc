export function chunkDocumentRows<T>(rows: T[], pageSize: number): T[][] {
  if (pageSize <= 0) return [rows];
  if (rows.length === 0) return [[]] as T[][];

  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += pageSize) {
    chunks.push(rows.slice(index, index + pageSize));
  }
  return chunks;
}

export function getDocumentPageCount(rowCount: number, pageSize: number) {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(rowCount / pageSize));
}

export function formatDocumentPageRange(startPage: number, pageCount: number) {
  const safeCount = Math.max(1, pageCount);
  const endPage = startPage + safeCount - 1;
  return startPage === endPage ? String(startPage) : `${startPage}-${endPage}`;
}