import type { SelectionData } from "./types";

const SENTENCE_TERMINATORS = /[.!?]/;

const BLOCK_ELEMENTS = new Set([
  "P", "DIV", "LI", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6",
  "SECTION", "ARTICLE", "MAIN", "HEADER", "FOOTER", "TD", "TH", "DD", "DT", "PRE",
]);

function extractSurroundingSentence(
  node: Node,
  selectedText: string
): string {
  const fullText = node.textContent ?? "";
  const selectionIndex = fullText.indexOf(selectedText);

  if (selectionIndex === -1) {
    return selectedText;
  }

  // Walk backward from selection start to find sentence beginning
  let sentenceStart = selectionIndex;
  for (let i = selectionIndex - 1; i >= 0; i--) {
    const char = fullText[i];
    if (SENTENCE_TERMINATORS.test(char)) {
      sentenceStart = i + 1;
      break;
    }
    if (i === 0) {
      sentenceStart = 0;
    }
  }

  // Walk forward from selection end to find sentence end
  const selectionEnd = selectionIndex + selectedText.length;
  let sentenceEnd = selectionEnd;
  for (let i = selectionEnd; i < fullText.length; i++) {
    const char = fullText[i];
    if (SENTENCE_TERMINATORS.test(char)) {
      sentenceEnd = i + 1;
      break;
    }
    if (i === fullText.length - 1) {
      sentenceEnd = fullText.length;
    }
  }

  return fullText.slice(sentenceStart, sentenceEnd).trim();
}

export function getSelectionWithContext(): SelectionData | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;

  // Capture the bounding rect from the range
  const domRect = range.getBoundingClientRect();
  const rect = {
    top: domRect.top,
    left: domRect.left,
    bottom: domRect.bottom,
    width: domRect.width,
  };

  // Find the closest block-level parent for better sentence context
  let contextNode: Node = container;
  if (container.nodeType === Node.TEXT_NODE && container.parentElement) {
    // Walk up to find a paragraph-level element
    let parent: HTMLElement | null = container.parentElement;
    while (parent) {
      if (BLOCK_ELEMENTS.has(parent.tagName)) {
        contextNode = parent;
        break;
      }
      parent = parent.parentElement;
    }
    if (!parent) {
      contextNode = container.parentElement;
    }
  }

  const sentence = extractSurroundingSentence(contextNode, text);

  return { text, sentence, rect };
}
