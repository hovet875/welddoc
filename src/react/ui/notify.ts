// src/react/ui/notify.ts
import { notifications } from "@mantine/notifications";

export function toast(message: string, ms = 2500) {
  notifications.show({ message, autoClose: ms });
}

export function notifySuccess(message: string, ms = 2500) {
  notifications.show({ message, autoClose: ms, color: "green" });
}

export function notifyError(message: string, ms = 4500) {
  notifications.show({ message, autoClose: ms, color: "red" });
}