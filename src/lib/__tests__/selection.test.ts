/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSelectionWithContext } from "../selection";

// jsdom doesn't implement getBoundingClientRect on Range
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = function () {
    return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
}

// Helper to set up a mock DOM selection
function mockSelection(text: string, fullText: string) {
  const textNode = document.createTextNode(fullText);
  const p = document.createElement("p");
  p.appendChild(textNode);
  document.body.appendChild(p);

  // Create a real range
  const range = document.createRange();
  const startOffset = fullText.indexOf(text);
  range.setStart(textNode, startOffset);
  range.setEnd(textNode, startOffset + text.length);

  // Mock window.getSelection
  vi.spyOn(window, "getSelection").mockReturnValue({
    toString: () => text,
    rangeCount: 1,
    getRangeAt: () => range,
  } as unknown as Selection);

  return p;
}

describe("getSelectionWithContext", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("returns null when no selection", () => {
    vi.spyOn(window, "getSelection").mockReturnValue(null);
    expect(getSelectionWithContext()).toBeNull();
  });

  it("returns null for empty selection", () => {
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "   ",
      rangeCount: 1,
      getRangeAt: () => document.createRange(),
    } as unknown as Selection);
    expect(getSelectionWithContext()).toBeNull();
  });

  it("extracts word with surrounding sentence", () => {
    mockSelection(
      "ubiquitous",
      "The word is common. The technology is ubiquitous in modern life. It really is."
    );
    const result = getSelectionWithContext();
    expect(result).not.toBeNull();
    expect(result!.text).toBe("ubiquitous");
    expect(result!.sentence).toBe(
      "The technology is ubiquitous in modern life."
    );
    expect(result!.rect).toEqual(
      expect.objectContaining({ top: expect.any(Number), left: expect.any(Number), bottom: expect.any(Number), width: expect.any(Number) })
    );
  });

  it("handles selection at start of text", () => {
    mockSelection("Hello", "Hello world. Goodbye.");
    const result = getSelectionWithContext();
    expect(result).not.toBeNull();
    expect(result!.text).toBe("Hello");
    expect(result!.sentence).toBe("Hello world.");
  });

  it("handles selection at end of text without terminator", () => {
    mockSelection("end", "This is the end");
    const result = getSelectionWithContext();
    expect(result).not.toBeNull();
    expect(result!.text).toBe("end");
    expect(result!.sentence).toBe("This is the end");
  });

  it("handles single sentence text", () => {
    mockSelection("word", "Just a word here");
    const result = getSelectionWithContext();
    expect(result).not.toBeNull();
    expect(result!.text).toBe("word");
    expect(result!.sentence).toBe("Just a word here");
  });

  it("falls back to selectedText when text not found in node content (lines 13-14)", () => {
    // Set up a text node whose content does NOT contain the selected text
    const textNode = document.createTextNode("Completely different content");
    const p = document.createElement("p");
    p.appendChild(textNode);
    document.body.appendChild(p);

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);

    // The selection toString returns text that is NOT in the node's textContent
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "nonexistent phrase",
      rangeCount: 1,
      getRangeAt: () => range,
    } as unknown as Selection);

    const result = getSelectionWithContext();
    expect(result).not.toBeNull();
    expect(result!.text).toBe("nonexistent phrase");
    // When indexOf returns -1, extractSurroundingSentence returns selectedText as-is
    expect(result!.sentence).toBe("nonexistent phrase");
  });

  it("falls back to parentElement when no block-level parent found", () => {
    // Create a detached DOM tree so parentElement chain ends at null
    const outerSpan = document.createElement("span");
    const innerSpan = document.createElement("span");
    outerSpan.appendChild(innerSpan);
    const textNode = document.createTextNode("Some inline text here.");
    innerSpan.appendChild(textNode);

    // Do NOT append to document.body — keep it detached so parent chain ends at outerSpan
    // whose parentElement is null. Since span is not a block element, it will
    // walk all the way up and fall back to container.parentElement.

    const range = document.createRange();
    const startOffset = "Some ".length;
    range.setStart(textNode, startOffset);
    range.setEnd(textNode, startOffset + "inline".length);

    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "inline",
      rangeCount: 1,
      getRangeAt: () => range,
    } as unknown as Selection);

    const result = getSelectionWithContext();
    expect(result).not.toBeNull();
    expect(result!.text).toBe("inline");
    // Should fall back to container.parentElement (innerSpan) since no block parent found
    expect(result!.sentence).toBe("Some inline text here.");
  });
});
