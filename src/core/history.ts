export class History {
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private maxDepth = 100;

  push(snapshot: string) {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxDepth) this.undoStack.shift();
    this.redoStack = [];
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  /** removes the last snapshot (used to cancel a no-op creation) */
  pop() {
    this.undoStack.pop();
  }

  /** returns previous snapshot or null */
  undo(current: string): string | null {
    const prev = this.undoStack.pop();
    if (prev === undefined) return null;
    this.redoStack.push(current);
    return prev;
  }

  redo(current: string): string | null {
    const next = this.redoStack.pop();
    if (next === undefined) return null;
    this.undoStack.push(current);
    return next;
  }
}
