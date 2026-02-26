import { useEffect, useRef } from "react";
import { formatErrorMessage } from "../../utils/error";

export type LegacyRender = (host: HTMLElement) => void | (() => void) | Promise<void | (() => void)>;

type LegacyPageProps = {
  render: LegacyRender;
};

export function LegacyPage({ render }: LegacyPageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let cleanup: void | (() => void);

    void Promise.resolve(render(host))
      .then((maybeCleanup) => {
        if (disposed) {
          if (typeof maybeCleanup === "function") maybeCleanup();
          return;
        }
        cleanup = maybeCleanup;
      })
      .catch((err) => {
        const msg = formatErrorMessage(err, "Ukjent feil");
        host.innerHTML = `<pre style="padding:16px;white-space:pre-wrap">REACT LEGACY PAGE ERROR:\n${msg}</pre>`;
      });

    return () => {
      disposed = true;
      if (typeof cleanup === "function") {
        try {
          cleanup();
        } catch {}
      }
      host.innerHTML = "";
    };
  }, [render]);

  return <div ref={hostRef} />;
}
