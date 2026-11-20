"use client";

import { useState } from "react";

/**
 * Keyset pagination state for `{items, next_cursor}` endpoints. Keeps a
 * stack of cursors so "Previous" works without offsets; only one page is
 * ever held in memory. Changing `resetKey` (e.g. serialized filters) returns
 * to page 1.
 */
export function useCursorPager(resetKey: string, initialPageSize = 25) {
  const [state, setState] = useState<{ key: string; stack: (number | null)[] }>({ key: resetKey, stack: [null] });
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const stale = state.key !== resetKey;
  const stack = stale ? [null] : state.stack;
  if (stale) setState({ key: resetKey, stack: [null] });

  return {
    cursor: stack[stack.length - 1] ?? undefined,
    page: stack.length,
    pageSize,
    hasPrev: stack.length > 1,
    next: (cursor: number) => setState({ key: resetKey, stack: [...stack, cursor] }),
    prev: () => setState({ key: resetKey, stack: stack.length > 1 ? stack.slice(0, -1) : stack }),
    reset: () => setState({ key: resetKey, stack: [null] }),
    setPageSize: (n: number) => {
      setPageSizeState(n);
      setState({ key: resetKey, stack: [null] });
    },
  };
}

export type CursorPager = ReturnType<typeof useCursorPager>;
