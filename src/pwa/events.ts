export const PWA_NEED_REFRESH_EVENT = "welddoc:pwa-need-refresh";
export const PWA_OFFLINE_READY_EVENT = "welddoc:pwa-offline-ready";

export type UpdateServiceWorkerFn = (reloadPage?: boolean) => Promise<void>;

export type PwaNeedRefreshDetail = {
  updateServiceWorker: UpdateServiceWorkerFn;
};

declare global {
  interface WindowEventMap {
    [PWA_NEED_REFRESH_EVENT]: CustomEvent<PwaNeedRefreshDetail>;
    [PWA_OFFLINE_READY_EVENT]: Event;
  }
}
