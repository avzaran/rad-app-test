import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutocompleteTextarea } from "./AutocompleteTextarea";

const acceptMock = vi.fn();
const dismissMock = vi.fn();
let suggestion = "";

vi.mock("../../hooks/useAutocomplete", () => ({
  useAutocomplete: () => ({
    suggestion,
    isLoading: false,
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
  beforeEach(() => {
    suggestion = " world";
    acceptMock.mockReset();
    dismissMock.mockReset();
  });

  it("accepts inline suggestion on Tab and keeps focus in textarea", async () => {
    acceptMock.mockReturnValue("Hello world");

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
  });
});
