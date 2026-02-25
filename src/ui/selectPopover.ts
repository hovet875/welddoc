export type SelectPopoverOption = {
  value: string;
  label?: string;
  description?: string;
};

export type SelectPopoverConfig = {
  /** Optional search input shown at top of popover */
  searchable?: boolean;
  searchPlaceholder?: string;
  maxHeightPx?: number;
  /** Called when user selects */
  onChange: (value: string) => void;
  /** Current value (for highlighting) */
  getValue: () => string | null;
  /** Optional: customize row rendering */
  renderOption?: (opt: SelectPopoverOption, isActive: boolean, isSelected: boolean) => string;
  signal?: AbortSignal;
};

/**
 * Wire a button to open a mobile-friendly popover list (locked values).
 * Uses a portal to document.body + fixed positioning.
 */
export function wireSelectPopover(
  button: HTMLButtonElement,
  options: SelectPopoverOption[],
  cfg: SelectPopoverConfig
) {
  const searchable = cfg.searchable ?? (options.length > 12);
  const maxHeightPx = cfg.maxHeightPx ?? 320;

  // Portal container
  const pop = document.createElement("div");
  pop.className = "sp-popover";
  pop.style.display = "none";
  pop.style.position = "fixed";
  pop.style.zIndex = "9999";
  document.body.appendChild(pop);

  let activeIndex = -1;
  let filtered: SelectPopoverOption[] = options.slice();
  let open = false;

  const cleanup = () => pop.remove();
  cfg.signal?.addEventListener("abort", cleanup, { once: true });

  const hide = () => {
    open = false;
    pop.style.display = "none";
    pop.innerHTML = "";
    activeIndex = -1;
    button.setAttribute("aria-expanded", "false");
  };

  const position = () => {
    if (!open) return;
    const r = button.getBoundingClientRect();
    const vv = window.visualViewport;

    const offsetLeft = vv?.offsetLeft ?? 0;
    const offsetTop = vv?.offsetTop ?? 0;

    const left = r.left + offsetLeft;
    const top = r.bottom + offsetTop;

    pop.style.left = `${Math.max(8, left)}px`;
    pop.style.top = `${Math.max(8, top)}px`;
    pop.style.width = `${Math.max(180, r.width)}px`;

    const viewportHeight = vv?.height ?? window.innerHeight;
    const spaceBelow = viewportHeight - (r.bottom + (vv?.offsetTop ?? 0)) - 8;
    const maxH = Math.max(180, Math.min(maxHeightPx, spaceBelow));
    pop.style.maxHeight = `${maxH}px`;
  };

  const defaultRender = (opt: SelectPopoverOption, isActive: boolean, isSelected: boolean) => {
    const label = escapeHtml(opt.label ?? opt.value);
    const desc = opt.description ? `<div class="sp-desc">${escapeHtml(opt.description)}</div>` : "";
    return `
      <div class="sp-item${isActive ? " is-active" : ""}${isSelected ? " is-selected" : ""}" role="option"
           aria-selected="${isSelected}" data-value="${escapeAttr(opt.value)}">
        <div class="sp-label">${label}</div>
        ${desc}
      </div>
    `;
  };

  const render = () => {
    const selected = (cfg.getValue() ?? "").toLowerCase();

    const header = searchable
      ? `
        <div class="sp-searchwrap">
          <input class="sp-search" type="search" placeholder="${escapeAttr(cfg.searchPlaceholder ?? "Søk...")}" />
        </div>
      `
      : "";

    const listHtml =
      filtered.length === 0
        ? `<div class="sp-empty">Ingen treff</div>`
        : filtered
            .map((opt, idx) => {
              const isSelected = opt.value.toLowerCase() === selected;
              const isActive = idx === activeIndex;
              const row = (cfg.renderOption ?? defaultRender)(opt, isActive, isSelected);
              // Ensure we keep a data-idx hook for keyboard navigation:
              return row.replace('data-value="', `data-idx="${idx}" data-value="`);
            })
            .join("");

    pop.innerHTML = `
      <div class="sp-panel" role="listbox">
        ${header}
        <div class="sp-list">${listHtml}</div>
      </div>
    `;

    pop.style.display = "block";
    button.setAttribute("aria-expanded", "true");
    position();

    if (searchable) {
      const input = pop.querySelector(".sp-search") as HTMLInputElement | null;
      input?.focus();

      input?.addEventListener("input", () => {
        const q = (input.value ?? "").trim().toLowerCase();
        filtered = q
          ? options.filter(o => (o.label ?? o.value).toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
          : options.slice();
        activeIndex = Math.min(activeIndex, filtered.length - 1);
        render();
      });
    }
  };

  const openPopover = () => {
    open = true;
    filtered = options.slice();
    activeIndex = Math.max(0, filtered.findIndex(o => o.value === cfg.getValue()));
    render();
  };

  // Button behavior
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");

  button.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      if (open) hide();
      else openPopover();
    },
    { signal: cfg.signal }
  );

  // Click outside
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!open) return;
      const t = e.target as Node;
      if (t === button || button.contains(t)) return;
      if (pop.contains(t)) return;
      hide();
    },
    { signal: cfg.signal }
  );

  // Select with pointer
  pop.addEventListener(
    "pointerdown",
    (e) => {
      const el = (e.target as HTMLElement).closest(".sp-item") as HTMLElement | null;
      if (!el) return;
      e.preventDefault();
      const v = el.getAttribute("data-value");
      if (!v) return;
      cfg.onChange(v);
      hide();
      button.focus();
    },
    { signal: cfg.signal }
  );

  // Keyboard navigation (when open)
  document.addEventListener(
    "keydown",
    (e) => {
      if (!open) return;

      if (e.key === "Escape") {
        hide();
        button.focus();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
        render();
        scrollActiveIntoView();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        render();
        scrollActiveIntoView();
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && filtered[activeIndex]) {
          e.preventDefault();
          cfg.onChange(filtered[activeIndex].value);
          hide();
          button.focus();
        }
      }
    },
    { signal: cfg.signal }
  );

  // Keep positioned
  window.addEventListener("scroll", position, { passive: true, signal: cfg.signal });
  window.addEventListener("resize", position, { passive: true, signal: cfg.signal });
  window.visualViewport?.addEventListener("resize", position, { passive: true, signal: cfg.signal });
  window.visualViewport?.addEventListener("scroll", position, { passive: true, signal: cfg.signal });

  function scrollActiveIntoView() {
    const el = pop.querySelector(`.sp-item[data-idx="${activeIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(s: string) {
  // simple, safe enough for attribute usage
  return escapeHtml(s).replaceAll("\n", " ");
}