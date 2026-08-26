import { useSyncExternalStore } from "react";
import { Editor, type EditorSnapshot } from "../../core/editor";

export const editor = new Editor();

export function useEditor(): EditorSnapshot {
  return useSyncExternalStore(editor.subscribe, editor.getSnapshot);
}
