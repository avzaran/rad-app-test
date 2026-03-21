import { describe, expect, it } from "vitest";
import { shouldHandleUnauthorizedWithRefresh } from "./http";

describe("shouldHandleUnauthorizedWithRefresh", () => {
  it("skips refresh recursion for auth endpoints", () => {
    expect(shouldHandleUnauthorizedWithRefresh("/auth/refresh")).toBe(false);
    expect(shouldHandleUnauthorizedWithRefresh("/auth/login")).toBe(false);
    expect(shouldHandleUnauthorizedWithRefresh("http://localhost:8080/auth/logout")).toBe(false);
  });

  it("allows token refresh for protected app endpoints", () => {
    expect(shouldHandleUnauthorizedWithRefresh("/me")).toBe(true);
    expect(shouldHandleUnauthorizedWithRefresh("/protocols")).toBe(true);
    expect(shouldHandleUnauthorizedWithRefresh("http://localhost:8080/templates")).toBe(true);
  });
});
