import axios, { AxiosError, AxiosHeaders } from "axios";
import { env } from "../lib/env";

type AuthConfig = {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
};

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

http.interceptors.request.use((request) => {
  const token = config.getAccessToken();
  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  return request;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config;
    if (!request) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const alreadyRetried = (request as { _retry?: boolean })._retry;

    if (status === 401 && !alreadyRetried) {
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

