import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "../store/authStore";

/**
 * Shared axios instance. baseURL "/api" is proxied to the backend by Vite in
 * dev. withCredentials lets the browser send the httpOnly refresh cookie to
 * the /api/auth routes.
 */
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

// Attach the in-memory access token to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * On a 401, transparently refresh the access token (using the refresh cookie)
 * and retry the original request once. Concurrent 401s share a single refresh
 * call via the `refreshing` promise.
 */
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data } = await axios.post("/api/auth/refresh", null, {
      withCredentials: true,
    });
    useAuthStore.getState().setAccessToken(data.accessToken);
    return data.accessToken as string;
  } catch {
    useAuthStore.getState().clearAuth();
    return null;
  }
}

const SKIP_REFRESH = ["/auth/refresh", "/auth/login", "/auth/register"];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const url = original?.url ?? "";
    const shouldRefresh =
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !SKIP_REFRESH.some((p) => url.includes(p));

    if (shouldRefresh) {
      original._retry = true;
      refreshing ??= refreshAccessToken();
      const token = await refreshing;
      refreshing = null;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

/** Extracts a human-readable message from an API error. */
export function getApiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error ?? err.message ?? fallback;
  }
  return fallback;
}
