import { esc } from "../utils/dom";

type PagerOptions = {
  totalPages: number;
  currentPage: number;
  dataAttrs?: Record<string, string>;
  firstLabel?: string;
  lastLabel?: string;
  prevLabel?: string;
  nextLabel?: string;
  showFirstLast?: boolean;
  showPrevNext?: boolean;
  boundaryCount?: number;
  siblingCount?: number;
};

function renderDataAttrs(dataAttrs?: Record<string, string>) {
  if (!dataAttrs) return "";
  const pairs = Object.entries(dataAttrs)
    .filter(([key, value]) => key && value != null)
    .map(([key, value]) => `data-${esc(key)}="${esc(String(value))}"`)
    .join(" ");
  return pairs ? ` ${pairs}` : "";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toSafeInt(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.floor(value);
}

function addRange(target: number[], start: number, end: number) {
  for (let page = start; page <= end; page += 1) {
    target.push(page);
  }
}

function buildVisiblePages(totalPages: number, currentPage: number, boundaryCount: number, siblingCount: number) {
  const pages: number[] = [];
  const leftBoundaryEnd = Math.min(boundaryCount, totalPages);
  const rightBoundaryStart = Math.max(totalPages - boundaryCount + 1, 1);

  addRange(pages, 1, leftBoundaryEnd);
  addRange(
    pages,
    Math.max(currentPage - siblingCount, leftBoundaryEnd + 1),
    Math.min(currentPage + siblingCount, rightBoundaryStart - 1)
  );
  addRange(pages, rightBoundaryStart, totalPages);

  return Array.from(new Set(pages)).sort((a, b) => a - b);
}

export function renderPagerButtons(opts: PagerOptions) {
  const totalPages = Math.max(0, toSafeInt(opts.totalPages, 0));
  if (totalPages <= 1) return "";

  const currentPage = clamp(toSafeInt(opts.currentPage, 1), 1, totalPages);
  const boundaryCount = Math.max(0, toSafeInt(opts.boundaryCount ?? 1, 1));
  const siblingCount = Math.max(0, toSafeInt(opts.siblingCount ?? 1, 1));
  const showFirstLast = opts.showFirstLast ?? true;
  const showPrevNext = opts.showPrevNext ?? true;

  const firstLabel = opts.firstLabel ?? "Forste";
  const lastLabel = opts.lastLabel ?? "Siste";
  const prevLabel = opts.prevLabel ?? "Forrige";
  const nextLabel = opts.nextLabel ?? "Neste";
  const dataAttrs = renderDataAttrs(opts.dataAttrs);
  const visiblePages = buildVisiblePages(totalPages, currentPage, boundaryCount, siblingCount);

  const buttons: string[] = [];

  if (showFirstLast) {
    buttons.push(
      `<button class="pager-btn" type="button" data-page="1"${dataAttrs} ${currentPage === 1 ? "disabled" : ""}>${esc(firstLabel)}</button>`
    );
  }

  if (showPrevNext) {
    buttons.push(
      `<button class="pager-btn" type="button" data-page="${currentPage - 1}"${dataAttrs} ${
        currentPage === 1 ? "disabled" : ""
      }>${esc(prevLabel)}</button>`
    );
  }

  let lastRendered = 0;
  for (const pageNo of visiblePages) {
    if (lastRendered && pageNo - lastRendered > 1) {
      buttons.push(`<span class="pager-gap" aria-hidden="true">...</span>`);
    }

    const isActive = pageNo === currentPage;
    buttons.push(
      `<button class="pager-btn${isActive ? " is-active" : ""}" type="button" data-page="${pageNo}"${dataAttrs} ${
        isActive ? 'aria-current="page"' : ""
      }>${pageNo}</button>`
    );
    lastRendered = pageNo;
  }

  if (showPrevNext) {
    buttons.push(
      `<button class="pager-btn" type="button" data-page="${currentPage + 1}"${dataAttrs} ${
        currentPage === totalPages ? "disabled" : ""
      }>${esc(nextLabel)}</button>`
    );
  }

  if (showFirstLast) {
    buttons.push(
      `<button class="pager-btn" type="button" data-page="${totalPages}"${dataAttrs} ${
        currentPage === totalPages ? "disabled" : ""
      }>${esc(lastLabel)}</button>`
    );
  }

  return buttons.join("");
}
