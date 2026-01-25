let mount: HTMLElement | null = null;

export function ensureToastMount() {
  if (mount) return mount;
  mount = document.createElement("div");
  mount.className = "toastmount";
  document.body.appendChild(mount);
  return mount;
}

export function toast(msg: string, ms = 2500) {
  const m = ensureToastMount();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  m.appendChild(el);

  const t = window.setTimeout(() => {
    el.remove();
    window.clearTimeout(t);
  }, ms);
}
