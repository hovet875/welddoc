import { AuthProvider } from "../auth/AuthProvider";
import { AppRouter } from "../router/AppRouter";

export function ReactApp() {
  return (
    <div className="react-root">
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </div>
  );
}
