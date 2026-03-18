import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutocompleteTextarea } from "./AutocompleteTextarea";

type AutocompleteStatus = "idle" | "debouncing" | "loading" | "ready" | "error";

const acceptMock = vi.hoisted(() => vi.fn());
const dismissMock = vi.hoisted(() => vi.fn());
const mockedAutocomplete = vi.hoisted(() => ({
  suggestion: "",
  status: "idle" as AutocompleteStatus,
}));

vi.mock("../../hooks/useAutocomplete", () => ({
  useAutocomplete: () => ({
    suggestion: mockedAutocomplete.suggestion,
    status: mockedAutocomplete.status,
    accept: acceptMock,
    dismiss: dismissMock,
  }),
}));

function Harness() {
  const [value, setValue] = useState("Hello");

  return (
    <AutocompleteTextarea
      aria-label="editor"
      value={value}
      onValueChange={setValue}
      modality="CT"
      templateContent="template"
      protocolId="p1"
      autocompleteEnabled
    />
  );
}

describe("AutocompleteTextarea", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    acceptMock.mockReset();
    dismissMock.mockReset();
    mockedAutocomplete.suggestion = " world";
    mockedAutocomplete.status = "ready";
  });

  it("shows a loading indicator and hides the shortcut hint while loading", () => {
    mockedAutocomplete.suggestion = "";
    mockedAutocomplete.status = "loading";

    render(<Harness />);

    expect(screen.getByRole("status", { name: "Автокомплит загружается" })).toBeInTheDocument();
    expect(screen.queryByText("Tab - принять, Esc - скрыть")).not.toBeInTheDocument();
  });

  it("shows the shortcut hint only when a suggestion is available", () => {
    mockedAutocomplete.suggestion = "";
    mockedAutocomplete.status = "loading";

    const { rerender } = render(<Harness />);

    expect(screen.queryByText("Tab - принять, Esc - скрыть")).not.toBeInTheDocument();

    mockedAutocomplete.suggestion = " world";
    mockedAutocomplete.status = "ready";
    rerender(<Harness />);

    expect(screen.getByText("Tab - принять, Esc - скрыть")).toBeInTheDocument();
  });

  it("dismisses the suggestion on Escape and clears the ghost text", async () => {
    dismissMock.mockImplementation(() => {
      mockedAutocomplete.suggestion = "";
      mockedAutocomplete.status = "idle";
    });

    const { rerender } = render(<Harness />);
    const textarea = screen.getByLabelText("editor") as HTMLTextAreaElement;
    const user = userEvent.setup();

    textarea.focus();
    textarea.setSelectionRange(5, 5);
    fireEvent.select(textarea);

    await user.keyboard("{Escape}");
    rerender(<Harness />);
    expect(dismissMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(" world")).not.toBeInTheDocument();
  });

  it("accepts inline suggestion on Tab, clears the ghost text, and keeps focus in textarea", async () => {
    acceptMock.mockImplementation(() => {
      mockedAutocomplete.suggestion = "";
      mockedAutocomplete.status = "idle";
      return "Hello world";
    });

    render(<Harness />);
    const textarea = screen.getByLabelText("editor") as HTMLTextAreaElement;
    const user = userEvent.setup();

    textarea.focus();
    textarea.setSelectionRange(5, 5);
    fireEvent.select(textarea);

    await user.keyboard("{Tab}");

    expect(acceptMock).toHaveBeenCalledTimes(1);
    expect(textarea).toHaveValue("Hello world");
    expect(document.activeElement).toBe(textarea);
    expect(screen.queryByText(" world")).not.toBeInTheDocument();
  });
});
