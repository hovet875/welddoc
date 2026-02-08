import { esc } from "../utils/dom";

type IconButtonOpts = {
  dataKey: string;
  id: string;
  title: string;
  icon: string;
  danger?: boolean;
  label?: string;
  extraClass?: string;
};

export function renderIconButton(opts: IconButtonOpts) {
  const cls = ["iconbtn", opts.danger ? "danger" : "", opts.extraClass || ""].filter(Boolean).join(" ");
  const aria = opts.label ? `${opts.title} ${opts.label}` : opts.title;
  return `
    <button class="${cls}" type="button" data-${esc(opts.dataKey)}="${esc(opts.id)}" aria-label="${esc(aria)}" title="${esc(opts.title)}">
      ${opts.icon}
    </button>
  `;
}

export function iconSvg(name: "pencil" | "trash" | "print" | "plus" | "eye" | "chevron-up" | "rotate-ccw" | "x") {
  if (name === "pencil") {
    return `
      <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
        <path fill="currentColor" d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182L8.25 18.463 3 19.5l1.037-5.25L16.862 3.487zM5.39 17.11l2.872-.566L18.98 5.826l-2.306-2.306L5.956 14.238l-.566 2.872z"/>
      </svg>
    `;
  }
  if (name === "print") {
    return `
      <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
        <path fill="currentColor" d="M7 2h10a1 1 0 0 1 1 1v4H6V3a1 1 0 0 1 1-1zm11 7a2 2 0 0 1 2 2v4h-3v-2H7v2H4v-4a2 2 0 0 1 2-2h12zm-1 8v4H7v-4h10zm-2 1H9v2h6v-2z"/>
      </svg>
    `;
  }
  if (name === "plus") {
    return `
      <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
        <path fill="currentColor" d="M11 5a1 1 0 0 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5z"/>
      </svg>
    `;
  }
  if (name === "eye") {
    return `
      <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
        <path fill="currentColor" d="M12 5c5.5 0 9.5 4.5 10.5 6-.99 1.5-5 6-10.5 6S2.5 12.5 1.5 11C2.5 9.5 6.5 5 12 5zm0 2c-3.4 0-6.5 2.6-8.1 4 1.6 1.4 4.7 4 8.1 4s6.5-2.6 8.1-4C18.5 9.6 15.4 7 12 7zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5z"/>
      </svg>
    `;
  }
  if (name === "chevron-up") {
    return `
      <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
        <path fill="currentColor" d="M6.7 14.7a1 1 0 0 1 0-1.4l4.6-4.6a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 1 1-1.4 1.4L12 10.8l-3.9 3.9a1 1 0 0 1-1.4 0z"/>
      </svg>
    `;
  }
  if (name === "rotate-ccw") {
    return `
      <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
        <path fill="currentColor" d="M7.1 7.1a7 7 0 1 1-1.1 7.3 1 1 0 1 1 1.9-.6A5 5 0 1 0 8 8.4l2.3 2.3H5V5.4l2.1 2.1z"/>
      </svg>
    `;
  }
  if (name === "x") {
    return `
      <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
        <path fill="currentColor" d="M6.7 5.3a1 1 0 0 1 1.4 0L12 9.2l3.9-3.9a1 1 0 1 1 1.4 1.4L13.4 10.6l3.9 3.9a1 1 0 1 1-1.4 1.4L12 12l-3.9 3.9a1 1 0 1 1-1.4-1.4l3.9-3.9-3.9-3.9a1 1 0 0 1 0-1.4z"/>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
      <path fill="currentColor" d="M9 3a1 1 0 0 0-1 1v1H5.5a1 1 0 1 0 0 2H6v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h.5a1 1 0 1 0 0-2H16V4a1 1 0 0 0-1-1H9zm1 2h4V4h-4v1zm-1 5a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0v-8a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0v-8a1 1 0 0 1 1-1z"/>
    </svg>
  `;
}
