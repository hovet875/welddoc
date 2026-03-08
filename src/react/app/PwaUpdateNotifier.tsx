import { useEffect } from "react";
import { Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { PWA_NEED_REFRESH_EVENT, PWA_OFFLINE_READY_EVENT, type PwaNeedRefreshDetail } from "@/pwa/events";

const UPDATE_NOTIFICATION_ID = "pwa-update-available";
const OFFLINE_NOTIFICATION_ID = "pwa-offline-ready";

export function PwaUpdateNotifier() {
  useEffect(() => {
    const onNeedRefresh = (event: Event) => {
      const { updateServiceWorker } = (event as CustomEvent<PwaNeedRefreshDetail>).detail;

      notifications.show({
        id: UPDATE_NOTIFICATION_ID,
        title: "Ny versjon tilgjengelig",
        autoClose: false,
        withCloseButton: false,
        message: (
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" style={{ flex: 1 }}>
              En ny versjon av WeldDoc er klar.
            </Text>
            <Button
              size="xs"
              onClick={() => {
                notifications.hide(UPDATE_NOTIFICATION_ID);
                void updateServiceWorker(true);
              }}
            >
              Oppdater
            </Button>
            <Button size="xs" variant="default" onClick={() => notifications.hide(UPDATE_NOTIFICATION_ID)}>
              Senere
            </Button>
          </Group>
        ),
      });
    };

    const onOfflineReady = () => {
      notifications.show({
        id: OFFLINE_NOTIFICATION_ID,
        message: "WeldDoc er klar for offline bruk.",
        autoClose: 3000,
      });
    };

    window.addEventListener(PWA_NEED_REFRESH_EVENT, onNeedRefresh);
    window.addEventListener(PWA_OFFLINE_READY_EVENT, onOfflineReady);

    return () => {
      window.removeEventListener(PWA_NEED_REFRESH_EVENT, onNeedRefresh);
      window.removeEventListener(PWA_OFFLINE_READY_EVENT, onOfflineReady);
      notifications.hide(UPDATE_NOTIFICATION_ID);
    };
  }, []);

  return null;
}
