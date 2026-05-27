import { useEffect } from "react";
import axios from "axios";
import { useAuthStore } from "../store/authStore";
import { fetchMe } from "../api/auth";

// Module-level guard: React StrictMode mounts effects twice in dev, but we must
// only attempt the cookie-based refresh once (refresh rotates the token).
let didBootstrap = false;

/**
 * On app load, try to restore the session: use the httpOnly refresh cookie to
 * get a fresh access token, then load the current user. Sets auth status to
 * authenticated or unauthenticated accordingly.
 */
export function useBootstrapAuth(): void {
  useEffect(() => {
    if (didBootstrap) return;
    didBootstrap = true;

    (async () => {
      try {
        const { data } = await axios.post("/api/auth/refresh", null, {
          withCredentials: true,
        });
        useAuthStore.getState().setAccessToken(data.accessToken);
        const user = await fetchMe();
        useAuthStore.getState().setAuth(user, data.accessToken);
      } catch {
        useAuthStore.getState().clearAuth();
      }
    })();
  }, []);
}
