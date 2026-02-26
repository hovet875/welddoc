import { AuthProvider } from "../auth/AuthProvider";
import { AppRouter } from "../router/AppRouter";

export function ReactApp() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
