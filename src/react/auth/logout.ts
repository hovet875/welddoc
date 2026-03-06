import { signOut } from "@/auth/authClient";

export async function signOutSafely(warnMessage: string) {
  try {
    await signOut();
  } catch (err) {
    console.warn(warnMessage, err);
  }
}
