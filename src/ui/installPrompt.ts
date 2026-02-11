type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  for (const cb of subscribers) cb();
}

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIosDevice() {
  const nav = window.navigator as Navigator & { maxTouchPoints?: number };
  const iosByUa = /iphone|ipad|ipod/i.test(nav.userAgent);
  const iPadDesktopMode = nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1;
  return iosByUa || iPadDesktopMode;
}

function isIosManualInstallCandidate() {
  return isIosDevice() && !isStandalone();
}

function isMobileInstallTarget() {
  if (isIosDevice()) return true;
  if (/android/i.test(window.navigator.userAgent)) return true;

  const nav = window.navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = (nav.userAgentData?.platform || nav.platform || "").toLowerCase();

  if (/win|mac|linux|cros/.test(platform)) return false;
  return false;
}

export function initInstallPromptEvents() {
  if (initialized) return;
  initialized = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifySubscribers();
  });
}

export function wireInstallHomeScreenButton(root: ParentNode) {
  const button = root.querySelector<HTMLButtonElement>("#install-home-screen");
  const hint = root.querySelector<HTMLElement>("#install-home-screen-hint");
  const labelEl = root.querySelector<HTMLElement>("[data-install-label]");
  const section = button?.closest<HTMLElement>(".logininstall");

  if (!button) return () => {};

  const setButtonLabel = (text: string) => {
    if (labelEl) {
      labelEl.textContent = text;
      return;
    }
    button.textContent = text;
  };

  const renderState = () => {
    if (!isMobileInstallTarget()) {
      if (section) section.hidden = true;
      button.hidden = true;
      if (hint) hint.hidden = true;
      return;
    }

    if (section) section.hidden = false;

    if (isStandalone()) {
      button.hidden = true;
      if (hint) hint.hidden = true;
      return;
    }

    if (deferredPrompt) {
      button.hidden = false;
      setButtonLabel("Installer app");
      if (hint) hint.hidden = true;
      return;
    }

    if (isIosManualInstallCandidate()) {
      button.hidden = false;
      setButtonLabel("Legg til på hjemskjerm");
      return;
    }

    button.hidden = true;
    if (hint) hint.hidden = true;
  };

  const onClick = async () => {
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;

      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "dismissed" && hint) {
          hint.textContent = "Installasjon avbrutt. Du kan installere senere fra nettlesermenyen.";
          hint.hidden = false;
        }
      } catch (err) {
        console.warn("Install prompt failed", err);
        if (hint) {
          hint.textContent = "Kunne ikke starte installasjon. Prøv fra nettlesermenyen (Installer app).";
          hint.hidden = false;
        }
      }
      renderState();
      return;
    }

    if (isIosManualInstallCandidate() && hint) {
      hint.textContent =
        "På iPhone/iPad: åpne menyen Del i nettleseren og velg Legg til på Hjem-skjerm.";
      hint.hidden = false;
      return;
    }

    if (hint) {
      hint.textContent = "Installasjon er ikke tilgjengelig i denne nettleseren akkurat nå.";
      hint.hidden = false;
    }
  };

  subscribers.add(renderState);
  button.addEventListener("click", onClick);
  renderState();

  return () => {
    subscribers.delete(renderState);
    button.removeEventListener("click", onClick);
  };
}

