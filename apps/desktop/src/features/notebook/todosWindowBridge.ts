import type { TimeLogRecord, TodoPriority, TodoRecord } from "@notesmith/domain";
import { isTauriRuntime } from "../../lib/storage/environment";

export const DETACHED_TODOS_WINDOW_LABEL = "notesmith-todos";
export const TODOS_COMMAND_EVENT = "notesmith:todos-command";
export const TODOS_SNAPSHOT_EVENT = "notesmith:todos-snapshot";

export type TodosWindowCommand =
  | { type: "request-snapshot" }
  | { type: "add"; description: string; isPrivate: boolean; priority: TodoPriority }
  | { type: "save"; todo: TodoRecord }
  | { type: "delete"; todoId: string }
  | { type: "add-note"; todoId: string }
  | { type: "toggle-time"; todoId: string; isRunning: boolean };

export interface TodosWindowSnapshot {
  todos: TodoRecord[];
  theme: string;
  runningTodoIds: string[];
}

export const getRunningTodoIds = (timeLogs: TimeLogRecord[]) =>
  Array.from(new Set(
    timeLogs
      .filter((log) => log.targetType === "todo" && log.startTime === log.endTime)
      .map((log) => log.targetId),
  ));

export const openDetachedTodosWindow = async () => {
  if (!isTauriRuntime()) {
    throw new Error("The detachable Todos window is available in the desktop app.");
  }

  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existing = await WebviewWindow.getByLabel(DETACHED_TODOS_WINDOW_LABEL);
  if (existing) {
    await existing.show();
    await existing.unminimize();
    await existing.setFocus();
    return existing;
  }

  return new Promise<InstanceType<typeof WebviewWindow>>((resolve, reject) => {
    const detachedWindow = new WebviewWindow(DETACHED_TODOS_WINDOW_LABEL, {
      url: "/?window=detached-todos",
      title: "NoteSmith Todos",
      width: 980,
      height: 760,
      minWidth: 620,
      minHeight: 460,
      center: true,
      decorations: true,
      resizable: true,
    });
    detachedWindow.once("tauri://created", () => resolve(detachedWindow));
    detachedWindow.once<string>("tauri://error", (event) => reject(new Error(event.payload)));
  });
};

export const sendTodosCommand = async (command: TodosWindowCommand) => {
  if (!isTauriRuntime()) return;
  const { emitTo } = await import("@tauri-apps/api/event");
  await emitTo("main", TODOS_COMMAND_EVENT, command);
};

export const sendTodosSnapshot = async (todos: TodoRecord[], theme: string, runningTodoIds: string[]) => {
  if (!isTauriRuntime()) return;
  const { emitTo } = await import("@tauri-apps/api/event");
  await emitTo(DETACHED_TODOS_WINDOW_LABEL, TODOS_SNAPSHOT_EVENT, { todos, theme, runningTodoIds } satisfies TodosWindowSnapshot);
};
