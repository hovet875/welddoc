import { esc } from "../utils/dom";

type PagerOptions = {
  totalPages: number;
  currentPage: number;
  dataAttrs?: Record<string, string>;
  firstLabel?: string;
  lastLabel?: string;
};

function renderDataAttrs(dataAttrs?: Record<string, string>) {
  if (!dataAttrs) return "";
  const pairs = Object.entries(dataAttrs)
    .filter(([key, value]) => key && value != null)
    .map(([key, value]) => `data-${esc(key)}="${esc(String(value))}"`)
    .join(" ");
  return pairs ? ` ${pairs}` : "";
}

export function renderPagerButtons(opts: PagerOptions) {
  if (opts.totalPages <= 1) return "";

  const firstLabel = opts.firstLabel ?? "Første";
  const lastLabel = opts.lastLabel ?? "Siste";
  const dataAttrs = renderDataAttrs(opts.dataAttrs);

  const buttons = [
    `<button class="pager-btn" type="button" data-page="1"${dataAttrs} ${
      opts.currentPage === 1 ? "disabled" : ""
    }>${esc(firstLabel)}</button>`,
    ...Array.from({ length: opts.totalPages }, (_, i) => {
      const pageNo = i + 1;
      const isActive = pageNo === opts.currentPage;
      return `<button class="pager-btn${isActive ? " is-active" : ""}" type="button" data-page="${pageNo}"${dataAttrs} ${
        isActive ? "aria-current=\"page\"" : ""
      }>${pageNo}</button>`;
    }),
    `<button class="pager-btn" type="button" data-page="${opts.totalPages}"${dataAttrs} ${
      opts.currentPage === opts.totalPages ? "disabled" : ""
    }>${esc(lastLabel)}</button>`,
  ];

  return buttons.join("");
}
