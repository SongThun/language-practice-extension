import React, { useState, useEffect, useCallback } from "react";
import { createWord, suggestDefinition } from "../../lib/api";
import { getDefaultLanguage, setDefaultLanguage } from "../../lib/storage";
import { LANGUAGES } from "../../lib/constants";
import { TagSelector } from "./TagSelector";

interface SaveWordFormProps {
  word: string;
  contextSentence: string;
  onClose: () => void;
}

export function SaveWordForm({
  word,
  contextSentence,
  onClose,
}: SaveWordFormProps) {
  const [definition, setDefinition] = useState("");
  const [language, setLanguage] = useState("en");
  const [context, setContext] = useState(contextSentence);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDefaultLanguage().then(setLanguage);
  }, []);

  const handleSuggestDefinition = useCallback(async () => {
    setSuggesting(true);
    setError(null);
    try {
      const result = await suggestDefinition({
        word,
        context_sentence: context || undefined,
        language,
      });
      setDefinition(result.definition);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to suggest definition"
      );
    } finally {
      setSuggesting(false);
    }
  }, [word, context, language]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await createWord({
        word,
        definition,
        language,
        context_sentence: context || undefined,
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      });

      // Remember the language choice
      await setDefaultLanguage(language);

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save word");
      setLoading(false);
    }
  }, [word, definition, language, context, selectedTagIds, onClose]);

  if (success) {
    return (
      <div className="lp-success">
        <span>&#10003;</span>
        <span>Saved!</span>
      </div>
    );
  }

  return (
    <div className="lp-overlay-body">
      <div className="lp-field">
        <label>Word</label>
        <input type="text" value={word} readOnly />
      </div>

      <div className="lp-field">
        <label>Definition</label>
        <textarea
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          placeholder="Enter definition..."
          rows={2}
        />
        <button
          className="lp-btn lp-btn-secondary"
          onClick={handleSuggestDefinition}
          disabled={suggesting}
          style={{ marginTop: "4px", fontSize: "11px", padding: "4px 10px" }}
        >
          {suggesting ? "Suggesting..." : "Suggest definition"}
        </button>
      </div>

      <div className="lp-field">
        <label>Language</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <div className="lp-field">
        <label>Context sentence</label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={2}
          placeholder="Sentence where you found this word..."
        />
      </div>

      <div className="lp-field">
        <label>Tags</label>
        <TagSelector
          selectedIds={selectedTagIds}
          onChange={setSelectedTagIds}
        />
      </div>

      {error && <div className="lp-error">{error}</div>}

      <div className="lp-actions">
        <button
          className="lp-btn lp-btn-primary"
          onClick={handleSave}
          disabled={loading || !definition.trim()}
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button className="lp-btn lp-btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
