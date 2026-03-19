import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { getSelectionWithContext } from "../lib/selection";
import { Overlay } from "./overlay";

const HOST_ID = "lp-extension-overlay-host";

let overlayHost: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let reactRoot: Root | null = null;
let isOverlayVisible = false;

function getOrCreateHost(): { host: HTMLDivElement; shadow: ShadowRoot } {
  if (overlayHost && shadowRoot) {
    return { host: overlayHost, shadow: shadowRoot };
  }

  overlayHost = document.createElement("div");
  overlayHost.id = HOST_ID;
  document.body.appendChild(overlayHost);

  shadowRoot = overlayHost.attachShadow({ mode: "open" });

  // Inject styles into shadow DOM
  const style = document.createElement("style");
  style.textContent = getShadowStyles();
  shadowRoot.appendChild(style);

  // Create React mount point
  const mountPoint = document.createElement("div");
  mountPoint.id = "lp-react-root";
  shadowRoot.appendChild(mountPoint);

  reactRoot = createRoot(mountPoint);

  return { host: overlayHost, shadow: shadowRoot };
}

function showOverlay(
  word: string,
  contextSentence: string,
  rect: DOMRect
): void {
  const { host } = getOrCreateHost();

  // Position near the selection
  const top = rect.bottom + window.scrollY + 8;
  let left = rect.left + window.scrollX;

  // Keep overlay within viewport
  const maxLeft = window.innerWidth - 416; // 400px overlay + 16px margin
  if (left > maxLeft) left = maxLeft;
  if (left < 8) left = 8;

  host.style.position = "absolute";
  host.style.top = `${top}px`;
  host.style.left = `${left}px`;
  host.style.pointerEvents = "auto";

  reactRoot?.render(
    createElement(Overlay, {
      word,
      contextSentence,
      onClose: hideOverlay,
    })
  );

  isOverlayVisible = true;
}

function hideOverlay(): void {
  if (reactRoot) {
    reactRoot.render(null);
  }
  if (overlayHost) {
    overlayHost.style.pointerEvents = "none";
  }
  isOverlayVisible = false;
}

// Listen for text selection
let pendingTimeout: number | null = null;
document.addEventListener("mouseup", (event) => {
  // Ignore clicks inside the overlay
  if (overlayHost?.contains(event.target as Node)) {
    return;
  }

  if (pendingTimeout) clearTimeout(pendingTimeout);

  // Small delay to let the selection finalize
  pendingTimeout = setTimeout(() => {
    pendingTimeout = null;
    const selectionData = getSelectionWithContext();

    if (!selectionData) {
      if (isOverlayVisible) hideOverlay();
      return;
    }

    const rect = new DOMRect(
      selectionData.rect.left,
      selectionData.rect.top,
      selectionData.rect.width,
      selectionData.rect.bottom - selectionData.rect.top
    );

    showOverlay(selectionData.text, selectionData.sentence, rect);
  }, 10) as unknown as number;
});

// Dismiss on Escape
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isOverlayVisible) {
    hideOverlay();
  }
});

// Dismiss when clicking outside
document.addEventListener("mousedown", (event) => {
  if (!isOverlayVisible) return;
  if (overlayHost?.contains(event.target as Node)) return;

  // Check if click is inside shadow DOM
  const path = event.composedPath();
  if (overlayHost && path.includes(overlayHost)) return;

  hideOverlay();
});

function getShadowStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .lp-overlay {
      font-family: "Roboto Mono", ui-monospace, monospace;
      width: 400px;
      max-height: 480px;
      overflow-y: auto;
      background: #2c2e31;
      border: 1px solid #464849;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      color: #d1d0c5;
      font-size: 13px;
      line-height: 1.5;
    }

    .lp-overlay-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #464849;
    }

    .lp-overlay-header h3 {
      font-size: 14px;
      font-weight: 600;
      color: #e2b714;
    }

    .lp-overlay-close {
      background: none;
      border: none;
      color: #646669;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .lp-overlay-close:hover {
      color: #d1d0c5;
      background: #323437;
    }

    .lp-overlay-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .lp-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .lp-field label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #646669;
    }

    .lp-field input,
    .lp-field textarea,
    .lp-field select {
      font-family: "Roboto Mono", ui-monospace, monospace;
      background: #323437;
      border: 1px solid #464849;
      border-radius: 6px;
      color: #d1d0c5;
      padding: 8px 10px;
      font-size: 13px;
      outline: none;
      width: 100%;
      resize: vertical;
    }

    .lp-field input:focus,
    .lp-field textarea:focus,
    .lp-field select:focus {
      border-color: #e2b714;
    }

    .lp-field textarea {
      min-height: 48px;
    }

    .lp-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .lp-tag-pill {
      font-family: "Roboto Mono", ui-monospace, monospace;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      cursor: pointer;
      border: 1px solid #464849;
      background: #323437;
      color: #646669;
      transition: all 0.15s;
    }

    .lp-tag-pill.selected {
      background: #e2b714;
      color: #2c2e31;
      border-color: #e2b714;
    }

    .lp-tag-pill:hover {
      border-color: #e2b714;
    }

    .lp-tag-add {
      display: flex;
      gap: 6px;
      margin-top: 4px;
    }

    .lp-tag-add input {
      font-family: "Roboto Mono", ui-monospace, monospace;
      flex: 1;
      background: #323437;
      border: 1px solid #464849;
      border-radius: 6px;
      color: #d1d0c5;
      padding: 4px 8px;
      font-size: 11px;
      outline: none;
    }

    .lp-tag-add input:focus {
      border-color: #e2b714;
    }

    .lp-tag-add button {
      font-family: "Roboto Mono", ui-monospace, monospace;
      background: #464849;
      border: none;
      color: #d1d0c5;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
    }

    .lp-tag-add button:hover {
      background: #646669;
    }

    .lp-actions {
      display: flex;
      gap: 8px;
      padding-top: 4px;
    }

    .lp-btn {
      font-family: "Roboto Mono", ui-monospace, monospace;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
    }

    .lp-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .lp-btn-primary {
      background: #e2b714;
      color: #2c2e31;
      flex: 1;
    }

    .lp-btn-primary:hover:not(:disabled) {
      background: #c9a312;
    }

    .lp-btn-secondary {
      background: #464849;
      color: #d1d0c5;
    }

    .lp-btn-secondary:hover:not(:disabled) {
      background: #646669;
    }

    .lp-success {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      gap: 8px;
      color: #e2b714;
      font-weight: 600;
    }

    .lp-error {
      color: #ca4754;
      font-size: 12px;
      padding: 4px 0;
    }

    .lp-not-authed {
      padding: 24px 16px;
      text-align: center;
      color: #646669;
      font-size: 12px;
    }

    .lp-not-authed a {
      color: #e2b714;
      text-decoration: none;
    }

    .lp-not-authed a:hover {
      text-decoration: underline;
    }
  `;
}
