type AutocompleteOptions = {
  maxItems?: number;
  signal?: AbortSignal;
};

export function wireAutocomplete(input: HTMLInputElement, items: string[], opts?: AutocompleteOptions) {
  const maxItems = opts?.maxItems ?? 8;
  const parent = input.closest(".field") ?? input.parentElement;
  if (!parent) return;

  parent.classList.add("has-autocomplete");

  const menu = document.createElement("div");
  menu.className = "autocomplete-menu";
  menu.setAttribute("role", "listbox");
  parent.appendChild(menu);

  const uniqueItems = Array.from(new Set(items.map((i) => i.trim()).filter(Boolean)));
  let activeIndex = -1;
  let visibleItems: string[] = [];

  const hide = () => {
    menu.innerHTML = "";
    menu.style.display = "none";
    activeIndex = -1;
  };

  const render = (list: string[]) => {
    visibleItems = list;
    if (list.length === 0) {
      hide();
      return;
    }
    menu.innerHTML = list
      .map((item, idx) => {
        const active = idx === activeIndex ? " is-active" : "";
        return `<div class="autocomplete-item${active}" data-idx="${idx}" role="option">${item}</div>`;
      })
      .join("");
    menu.style.display = "block";
  };

  const filter = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      hide();
      return;
    }
    const list = uniqueItems
      .filter((i) => i.toLowerCase().includes(q))
      .slice(0, maxItems);
    activeIndex = -1;
    render(list);
  };

  const selectAt = (idx: number) => {
    const item = visibleItems[idx];
    if (!item) return;
    input.value = item;
    hide();
  };

  input.addEventListener("input", filter, { signal: opts?.signal });
  input.addEventListener("focus", filter, { signal: opts?.signal });

  input.addEventListener(
    "keydown",
    (e) => {
      if (menu.style.display !== "block") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, visibleItems.length - 1);
        render(visibleItems);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        render(visibleItems);
      }
      if (e.key === "Enter") {
        if (activeIndex >= 0) {
          e.preventDefault();
          selectAt(activeIndex);
        }
      }
      if (e.key === "Escape") {
        hide();
      }
    },
    { signal: opts?.signal }
  );

  menu.addEventListener(
    "mousedown",
    (e) => {
      const target = e.target as HTMLElement;
      const idx = Number(target.getAttribute("data-idx"));
      if (Number.isNaN(idx)) return;
      e.preventDefault();
      selectAt(idx);
    },
    { signal: opts?.signal }
  );

  document.addEventListener(
    "click",
    (e) => {
      if (parent.contains(e.target as Node)) return;
      hide();
    },
    { signal: opts?.signal }
  );
}
