import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FirstRunLanguageChoice } from "./FirstRunLanguageChoice";

describe("first-run language choice", () => {
  it("shows primary languages immediately, expands the remaining languages, and keeps tap selection working", () => {
    const onStart = vi.fn();
    const onSelect = vi.fn();
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    render(
      <FirstRunLanguageChoice
        selectedLanguage={null}
        t={(key) => key}
        onStart={onStart}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByTestId("language-choice-hi")).toBeVisible();
    expect(screen.getByTestId("language-choice-bn")).toBeVisible();
    expect(screen.getByTestId("language-choice-as")).toBeVisible();
    expect(screen.getByTestId("language-choice-en")).toBeVisible();
    expect(screen.queryByTestId("language-choice-te")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "startLanguagePrompt" }));
    expect(onStart).toHaveBeenCalledOnce();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "moreLanguages" }));
    expect(screen.getByTestId("language-choice-te")).toBeVisible();
    fireEvent.click(screen.getByTestId("language-choice-hi"));
    expect(onSelect).toHaveBeenCalledWith("hi");
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
