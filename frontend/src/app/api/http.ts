import axios, { AxiosError, AxiosHeaders } from "axios";
import { env } from "../lib/env";

type AuthConfig = {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
};

function normalizeRequestPath(url?: string): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }

  return url.startsWith("/") ? url : `/${url}`;
}

export function shouldHandleUnauthorizedWithRefresh(url?: string): boolean {
  const path = normalizeRequestPath(url);
  if (!path) {
    return true;
  }

  return !path.startsWith("/auth/");
}

const config: AuthConfig = {
  getAccessToken: () => null,
  refreshAccessToken: async () => null,
};

export const http = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export const authHttp = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

http.interceptors.request.use((request) => {
  const token = config.getAccessToken();
  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  return request;
});

const MAX_RETRIES_429 = 3;
const RETRY_BASE_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config;
    if (!request) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const retryCount = (request as { _retryCount?: number })._retryCount ?? 0;

    // Retry on 429 with exponential backoff
    if (status === 429 && retryCount < MAX_RETRIES_429) {
      (request as { _retryCount?: number })._retryCount = retryCount + 1;
      const delay = RETRY_BASE_MS * Math.pow(2, retryCount);
      await sleep(delay);
      return http(request);
    }

    // Refresh token on 401
    const alreadyRetried = (request as { _retry?: boolean })._retry;
    if (status === 401 && !alreadyRetried && shouldHandleUnauthorizedWithRefresh(request.url)) {
      (request as { _retry?: boolean })._retry = true;
      const refreshed = await config.refreshAccessToken();
      if (refreshed) {
        request.headers = request.headers ?? new AxiosHeaders();
        request.headers.Authorization = `Bearer ${refreshed}`;
        return http(request);
      }
    }

    return Promise.reject(error);
  }
);

export function configureHttpAuth(nextConfig: AuthConfig): void {
  config.getAccessToken = nextConfig.getAccessToken;
  config.refreshAccessToken = nextConfig.refreshAccessToken;
}

export function getAccessToken(): string | null {
  return config.getAccessToken();
}
