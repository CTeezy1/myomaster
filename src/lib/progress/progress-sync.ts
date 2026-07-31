export type ProgressSyncHandlers = {
  onChange: () => void;
  onImmediateChange: () => void;
};

let syncHandlers: ProgressSyncHandlers | null = null;
let suppressSyncDepth = 0;

export function registerProgressSyncHandlers(handlers: ProgressSyncHandlers | null) {
  syncHandlers = handlers;
}

export function runWithoutProgressSync(action: () => void) {
  suppressSyncDepth += 1;

  try {
    action();
  } finally {
    suppressSyncDepth -= 1;
  }
}

export function notifyProgressChanged(options: { immediate?: boolean } = {}) {
  if (suppressSyncDepth > 0 || !syncHandlers) {
    return;
  }

  if (options.immediate) {
    syncHandlers.onImmediateChange();
    return;
  }

  syncHandlers.onChange();
}

export function resetProgressSyncHandlersForTests() {
  syncHandlers = null;
  suppressSyncDepth = 0;
}
