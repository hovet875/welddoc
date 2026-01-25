export function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[c] ?? c;
  });
}

export function renderOptions(list: readonly string[], placeholder = "Velg…") {
  return [
    `<option value="">${esc(placeholder)}</option>`,
    ...list.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`),
  ].join("");
}

export function qs<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector(sel) as T | null;
  if (!el) throw new Error(`Fant ikke element: ${sel}`);
  return el;
}

export function qsa<T extends Element>(root: ParentNode, sel: string) {
  return Array.from(root.querySelectorAll(sel)) as T[];
}
