import { esc } from "../utils/dom";

type DatePickerInput = HTMLInputElement & {
  showPicker?: () => void;
};

type RenderDatePickerInputOpts = {
  value?: string;
  inputAttrs?: string;
  openLabel?: string;
  name?: string;
  id?: string;
};

function openDatePicker(input: DatePickerInput) {
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch {}
  }
  input.focus();
  input.click();
}

function isDateInput(el: EventTarget | null): el is DatePickerInput {
  return el instanceof HTMLInputElement && el.matches("input[type='date'][data-date-input]");
}

function isTextEntryKey(e: KeyboardEvent) {
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
}

function readAttrValue(attrs: string, attrName: string): string | null {
  const quoted = attrs.match(new RegExp(`(?:^|\\s)${attrName}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  if (quoted) return quoted[2] ?? null;
  const unquoted = attrs.match(new RegExp(`(?:^|\\s)${attrName}\\s*=\\s*([^\\s"'>]+)`, "i"));
  if (unquoted) return unquoted[1] ?? null;
  return null;
}

function hasAttr(attrs: string, attrName: string) {
  return new RegExp(`(?:^|\\s)${attrName}(?:\\s*=|\\s|$)`, "i").test(attrs);
}

function safeFieldName(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function renderDatePickerInput(opts?: RenderDatePickerInputOpts) {
  const valueAttr = opts?.value ? ` value="${esc(opts.value)}"` : "";
  const attrs = opts?.inputAttrs ? ` ${opts.inputAttrs}` : "";
  const label = esc(opts?.openLabel ?? "Velg dato");
  const attrsRaw = opts?.inputAttrs?.trim() ?? "";

  const explicitName = (opts?.name || "").trim();
  let nameAttr = "";
  if (!hasAttr(attrsRaw, "name")) {
    const fromDataField = safeFieldName(readAttrValue(attrsRaw, "data-f") || "");
    const inferredName = explicitName || fromDataField || "date";
    nameAttr = ` name="${esc(inferredName)}"`;
  }

  const explicitId = (opts?.id || "").trim();
  let idAttr = "";
  if (explicitId && !hasAttr(attrsRaw, "id")) {
    idAttr = ` id="${esc(explicitId)}"`;
  }

  return `
    <div class="date-picker" data-date-picker>
      <input type="date" data-date-input inputmode="none"${valueAttr}${nameAttr}${idAttr}${attrs} />
      <button type="button" class="date-picker__btn" data-date-open aria-label="${label}" title="${label}">
        <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
          <path fill="currentColor" d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1zm12 8H5v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9zM6 6a1 1 0 0 0-1 1v1h14V7a1 1 0 0 0-1-1H6z"/>
        </svg>
      </button>
    </div>
  `;
}

export function wireDatePickers(root: HTMLElement, signal?: AbortSignal) {
  const onClick = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const openBtn = target.closest<HTMLElement>("[data-date-open]");
    if (!openBtn) return;
    const wrapper = openBtn.closest<HTMLElement>("[data-date-picker]");
    const input = wrapper?.querySelector<DatePickerInput>("input[type='date'][data-date-input]");
    if (!input) return;
    openDatePicker(input);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!isDateInput(e.target)) return;

    if ((e.key === "Enter" || e.key === " ") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openDatePicker(e.target);
      return;
    }

    // Avoid buggy partial keyboard editing in date fields; use picker instead.
    if (isTextEntryKey(e)) {
      e.preventDefault();
    }
  };

  const onWheel = (e: WheelEvent) => {
    if (!isDateInput(e.target)) return;
    // Prevent accidental scroll-based date changes.
    e.preventDefault();
  };

  root.addEventListener("click", onClick, signal ? { signal } : undefined);
  root.addEventListener("keydown", onKeyDown, signal ? { signal } : undefined);
  root.addEventListener("wheel", onWheel, signal ? { signal, passive: false } : { passive: false });
}
