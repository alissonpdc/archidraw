import { useCallback, useRef, useSyncExternalStore } from "react";
import { Editor, type EditorSnapshot } from "../../core/editor";

export const editor = new Editor();

export function useEditor(): EditorSnapshot {
  return useSyncExternalStore(editor.subscribe, editor.getSnapshot);
}

export function useEditorSelector<T>(
  selector: (snap: EditorSnapshot) => T,
  isEqual: (prev: T, next: T) => boolean = Object.is,
): T {
  const lastValRef = useRef<T | undefined>(undefined);
  const hasValRef = useRef(false);

  const getSelection = useCallback(() => {
    const nextVal = selector(editor.getSnapshot());
    if (!hasValRef.current || !isEqual(lastValRef.current as T, nextVal)) {
      lastValRef.current = nextVal;
      hasValRef.current = true;
    }
    return lastValRef.current as T;
  }, [selector, isEqual]);

  return useSyncExternalStore(editor.subscribe, getSelection);
}
