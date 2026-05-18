// Keyboard shortcuts for undo / redo.
//
//   Undo : Ctrl + Z (Win/Linux) or Cmd + Z (macOS)
//   Redo : Ctrl + Y, Ctrl + Shift + Z, or Cmd + Shift + Z
//
// Skips events that originate from text inputs / textareas / contenteditable
// elements so the browser's native undo keeps working while editing text
// (search box, note popover, save-name input, etc.).
//
// Caller passes in `onUndo` / `onRedo` along with `canUndo` / `canRedo`
// flags; nothing fires when there's nothing to undo / redo. The handler
// is registered on `window` for the lifetime of the component using the
// hook, then cleaned up on unmount.

import { useEffect } from "react";

type Params = {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  enabled?: boolean; // optional master switch
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useUndoKeyboardShortcuts({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  enabled = true,
}: Params) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Modifier required — Ctrl on Win/Linux, Meta (⌘) on macOS.
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      // Let the browser handle native undo inside editable fields.
      if (isEditableTarget(e.target)) return;

      const key = e.key.toLowerCase();

      // Redo: Ctrl+Y, or Ctrl/Cmd+Shift+Z
      if (key === "y" || (key === "z" && e.shiftKey)) {
        if (!canRedo) return;
        e.preventDefault();
        onRedo();
        return;
      }

      // Undo: Ctrl/Cmd+Z (without shift)
      if (key === "z") {
        if (!canUndo) return;
        e.preventDefault();
        onUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onUndo, onRedo, canUndo, canRedo, enabled]);
}
