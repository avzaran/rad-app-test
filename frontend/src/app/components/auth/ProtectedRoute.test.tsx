import { describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { render, screen } from "@testing-library/react";
import { ProtectedRoute } from "./ProtectedRoute";
import { useAuthStore } from "../../store/authStore";

function renderWithRouter(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        Component: ProtectedRoute,
        children: [{ index: true, element: <div>private</div> }],
      },
      {
        path: "/login",
        element: <div>login</div>,
      },
    ],
    {
      initialEntries: [initialPath],
    }
  );

  render(<RouterProvider router={router} />);
}

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to login", async () => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      bootstrapped: true,
    });

    renderWithRouter("/");
    expect(await screen.findByText("login")).toBeInTheDocument();
  });

  it("renders private route for authenticated users", async () => {
    useAuthStore.setState({
      accessToken: "token",
      bootstrapped: true,
      user: {
        id: "u1",
        email: "doctor@radassist.local",
        fullName: "Doctor",
        role: "doctor",
        twoFaEnabled: false,
      },
    });

    renderWithRouter("/");
    expect(await screen.findByText("private")).toBeInTheDocument();
  });
});
