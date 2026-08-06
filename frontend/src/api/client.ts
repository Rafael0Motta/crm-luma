import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3333",
});

export const TOKEN_KEY = "luma_token";
export const REFRESH_TOKEN_KEY = "luma_refresh_token";

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function redirectToLogin() {
  clearSession();
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken })
      .then((res) => {
        localStorage.setItem(TOKEN_KEY, res.data.token);
        localStorage.setItem(REFRESH_TOKEN_KEY, res.data.refreshToken);
        return res.data.token as string;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthRoute = originalRequest?.url?.includes("/auth/login") || originalRequest?.url?.includes("/auth/refresh");

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthRoute) {
      originalRequest._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }
      redirectToLogin();
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error ?? err.message;
  }
  return "Erro inesperado";
}
