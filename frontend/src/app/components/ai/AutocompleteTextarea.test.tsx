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
  overlapText: "",
  status: "idle" as AutocompleteStatus,
  totalTokensUsed: 0,
}));

vi.mock("../../hooks/useAutocomplete", () => ({
  useAutocomplete: () => ({
    suggestion: mockedAutocomplete.suggestion,
    overlapText: mockedAutocomplete.overlapText,
    status: mockedAutocomplete.status,
    totalTokensUsed: mockedAutocomplete.totalTokensUsed,
    accept: acceptMock,
    dismiss: dismissMock,
  }),
}));

function Harness({ initialValue = "Hello" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);

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
    mockedAutocomplete.overlapText = "";
    mockedAutocomplete.status = "ready";
    mockedAutocomplete.totalTokensUsed = 0;
  });

  it("shows a loading indicator and hides the shortcut hint while loading", () => {
    mockedAutocomplete.suggestion = "";
    mockedAutocomplete.status = "loading";

    render(<Harness />);
    const textarea = screen.getByLabelText("editor");
    const wrapper = textarea.parentElement;

    expect(screen.getByRole("status", { name: "Автокомплит загружается" })).toBeInTheDocument();
    expect(wrapper).toContainElement(screen.getByRole("status", { name: "Автокомплит загружается" }));
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

    const textarea = screen.getByLabelText("editor");
    const wrapper = textarea.parentElement;

    expect(screen.getByText("Tab - принять, Esc - скрыть")).toBeInTheDocument();
    expect(wrapper).toContainElement(screen.getByText("Tab - принять, Esc - скрыть"));
  });

  it("renders ghost text only at the end of the line", () => {
    render(<Harness initialValue="Hello" />);

    const textarea = screen.getByLabelText("editor");
    const wrapper = textarea.parentElement;
    const mirror = wrapper?.querySelector('[aria-hidden="true"]');
    const popup = screen.queryByTestId("autocomplete-popup");

    expect(mirror).toHaveTextContent("world");
    expect(popup).not.toBeInTheDocument();
    expect(textarea).not.toHaveClass("text-transparent");
  });

  it("shows a cursor-style popup for mid-sentence suggestions", () => {
    mockedAutocomplete.suggestion = "amazing ";
    mockedAutocomplete.overlapText = "world";

    render(<Harness initialValue="Hello world" />);
    const textarea = screen.getByLabelText("editor") as HTMLTextAreaElement;

    textarea.focus();
    textarea.setSelectionRange(6, 6);
    fireEvent.select(textarea);

    const popup = screen.getByTestId("autocomplete-popup");

    expect(popup).toBeInTheDocument();
    expect(popup).toHaveAttribute("data-placement");
    expect(popup).toHaveTextContent("amazing");
    expect(popup).toHaveTextContent("world");
    expect(screen.getByTestId("autocomplete-ghost")).toBeEmptyDOMElement();
  });

  it("renders the protocol editor textarea with fixed field sizing", () => {
    render(<Harness />);

    expect(screen.getByLabelText("editor")).toHaveClass("field-sizing-fixed");
  });

  it("shows a subtle token counter outside the textarea wrapper", () => {
    mockedAutocomplete.totalTokensUsed = 24;

    render(<Harness />);
    const textarea = screen.getByLabelText("editor");
    const wrapper = textarea.parentElement;
    const tokenCounter = screen.getByText("24 ток.");

    expect(tokenCounter).toBeInTheDocument();
    expect(wrapper).not.toContainElement(tokenCounter);
  });

  it("dismisses the mid-sentence popup on Escape", async () => {
    dismissMock.mockImplementation(() => {
      mockedAutocomplete.suggestion = "";
      mockedAutocomplete.overlapText = "";
      mockedAutocomplete.status = "idle";
    });

    const { rerender } = render(<Harness initialValue="Hello world" />);
    const textarea = screen.getByLabelText("editor") as HTMLTextAreaElement;
    const user = userEvent.setup();

    textarea.focus();
    textarea.setSelectionRange(6, 6);
    fireEvent.select(textarea);

    await user.keyboard("{Escape}");
    rerender(<Harness initialValue="Hello world" />);
    expect(dismissMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("autocomplete-popup")).not.toBeInTheDocument();
  });

  it("accepts mid-sentence popup suggestion on Tab without duplicating the suffix", async () => {
    acceptMock.mockImplementation(() => {
      mockedAutocomplete.suggestion = "";
      mockedAutocomplete.overlapText = "";
      mockedAutocomplete.status = "idle";
      return "Hello amazing world";
    });

    render(<Harness initialValue="Hello world" />);
    const textarea = screen.getByLabelText("editor") as HTMLTextAreaElement;
    const user = userEvent.setup();

    textarea.focus();
    textarea.setSelectionRange(6, 6);
    fireEvent.select(textarea);

    await user.keyboard("{Tab}");

    expect(acceptMock).toHaveBeenCalledTimes(1);
    expect(textarea).toHaveValue("Hello amazing world");
    expect(document.activeElement).toBe(textarea);
    expect(screen.queryByTestId("autocomplete-popup")).not.toBeInTheDocument();
  });
});
