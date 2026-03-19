import React, { useState, useEffect, useCallback } from "react";
import { listTags, createTag } from "../../lib/api";
import type { Tag } from "../../lib/types";

interface TagSelectorProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

export function TagSelector({ selectedIds, onChange }: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTags()
      .then(setTags)
      .catch((err) => {
        console.error("Failed to load tags:", err);
        setError("Failed to load tags");
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleTag = useCallback(
    (id: number) => {
      if (selectedIds.includes(id)) {
        onChange(selectedIds.filter((tid) => tid !== id));
      } else {
        onChange([...selectedIds, id]);
      }
    },
    [selectedIds, onChange]
  );

  const handleCreateTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name) return;

    setCreating(true);
    setError(null);
    try {
      const tag = await createTag({ name });
      setTags((prev) => [...prev, tag]);
      onChange([...selectedIds, tag.id]);
      setNewTagName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tag");
    } finally {
      setCreating(false);
    }
  }, [newTagName, selectedIds, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCreateTag();
      }
    },
    [handleCreateTag]
  );

  if (loading) {
    return (
      <div style={{ color: "#646669", fontSize: "11px" }}>Loading tags...</div>
    );
  }

  return (
    <div>
      {tags.length > 0 && (
        <div className="lp-tags">
          {tags.map((tag) => (
            <button
              key={tag.id}
              className={`lp-tag-pill ${selectedIds.includes(tag.id) ? "selected" : ""}`}
              onClick={() => toggleTag(tag.id)}
              type="button"
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      <div className="lp-tag-add">
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New tag..."
          disabled={creating}
        />
        <button onClick={handleCreateTag} disabled={creating || !newTagName.trim()}>
          {creating ? "..." : "+"}
        </button>
      </div>

      {error && <div className="lp-error">{error}</div>}
    </div>
  );
}
