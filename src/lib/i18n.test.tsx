import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "./i18n";

function LanguageProbe() {
  const { lang, setLang } = useI18n();
  return (
    <>
      <p data-testid="active-language">{lang}</p>
      <button onClick={() => setLang("hi")}>Choose Hindi</button>
    </>
  );
}

describe("fresh language state", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores a saved language and does not persist the current session choice", () => {
    const storage = { getItem: vi.fn(() => "hi"), setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);

    const { unmount } = render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );

    expect(screen.getByTestId("active-language")).toHaveTextContent("en");
    fireEvent.click(screen.getByRole("button", { name: "Choose Hindi" }));
    expect(screen.getByTestId("active-language")).toHaveTextContent("hi");
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();

    unmount();
    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("active-language")).toHaveTextContent("en");
  });
});
