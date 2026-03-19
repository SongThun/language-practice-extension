import React from "react";
import { SaveWordForm } from "./components/SaveWordForm";
import { useSession } from "../lib/hooks";

interface OverlayProps {
  word: string;
  contextSentence: string;
  onClose: () => void;
}

export function Overlay({ word, contextSentence, onClose }: OverlayProps) {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="lp-overlay">
        <div className="lp-overlay-body" style={{ padding: "24px", textAlign: "center" }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="lp-overlay">
        <div className="lp-overlay-header">
          <h3>Language Practice</h3>
          <button className="lp-overlay-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="lp-not-authed">
          <p>Sign in to save words.</p>
          <p style={{ marginTop: "8px" }}>
            Open the extension popup to log in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-overlay">
      <div className="lp-overlay-header">
        <h3>Save Word</h3>
        <button className="lp-overlay-close" onClick={onClose}>
          &times;
        </button>
      </div>
      <SaveWordForm
        word={word}
        contextSentence={contextSentence}
        onClose={onClose}
      />
    </div>
  );
}
