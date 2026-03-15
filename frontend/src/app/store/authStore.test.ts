import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "./authStore";

describe("auth store", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      bootstrapped: false,
    });
    window.localStorage.removeItem("radassist-mock-refresh");
  });

  it("logins with mock credentials", async () => {
    await useAuthStore.getState().login({
      email: "admin@radassist.local",
      password: "admin123",
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeTruthy();
    expect(state.user?.role).toBe("admin");
  });

  it("fails with invalid credentials", async () => {
    await expect(
      useAuthStore.getState().login({
        email: "admin@radassist.local",
        password: "wrong",
      })
    ).rejects.toThrow();
  });
});
