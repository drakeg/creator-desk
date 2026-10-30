import type {
  ImportPreview,
  CommitImportInput,
  DashboardInput,
  Dashboard,
} from "./analytics";
import { z } from "zod";
import type { YouTubeState } from "./youtube";
export const workspaceName = z
  .string()
  .trim()
  .min(1, "Enter a workspace name.")
  .max(80, "Use 80 characters or fewer.")
  .refine(
    (v) =>
      Array.from(v).every(
        (c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127,
      ),
    "Use a name without control characters.",
  );
export const appearance = z.enum(["system", "light", "dark"]);
export const nameInput = z.object({ name: workspaceName }).strict();
export const idInput = z.object({ id: z.uuid() }).strict();
export const renameInput = idInput.extend({ name: workspaceName }).strict();
export const appearanceInput = z.object({ mode: appearance }).strict();
export const sidebarInput = z.object({ collapsed: z.boolean() }).strict();
export const restoreInput = z.object({ previewId: z.uuid() }).strict();
export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
export interface CoreState {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  appearance: z.infer<typeof appearance>;
  sidebarCollapsed: boolean;
  dataLocation: string;
  version: string;
}
export interface RestorePreview {
  previewId: string;
  createdAt: string;
  workspaces: { id: string; name: string }[];
}
export type CoreErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "STORAGE_UNAVAILABLE"
  | "UNSUPPORTED_VERSION"
  | "INVALID_BACKUP"
  | "CANCELLED"
  | "REMOTE_ERROR";
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: CoreErrorCode; message: string } };
export interface DesktopCore {
  readonly runtime: { sandboxed: boolean; contextIsolated: boolean };
  getState(): Promise<Result<CoreState>>;
  getYouTube(): Promise<Result<YouTubeState>>;
  importYouTubeClient(): Promise<Result<YouTubeState | null>>;
  connectYouTube(): Promise<Result<YouTubeState>>;
  cancelYouTube(): Promise<Result<YouTubeState>>;
  disconnectYouTube(): Promise<Result<YouTubeState>>;
  syncYouTube(): Promise<Result<YouTubeState>>;
  inspectImport(): Promise<Result<ImportPreview | null>>;
  commitImport(
    input: CommitImportInput,
  ): Promise<Result<{ reportId: string; duplicate: boolean }>>;
  cancelImport(): Promise<Result<null>>;
  getDashboard(input: DashboardInput): Promise<Result<Dashboard>>;
  createWorkspace(input: { name: string }): Promise<Result<Workspace>>;
  selectWorkspace(input: { id: string }): Promise<Result<CoreState>>;
  renameWorkspace(input: {
    id: string;
    name: string;
  }): Promise<Result<Workspace>>;
  updateAppearance(input: {
    mode: CoreState["appearance"];
  }): Promise<Result<CoreState>>;
  updateSidebar(input: { collapsed: boolean }): Promise<Result<CoreState>>;
  exportBackup(): Promise<Result<{ cancelled: boolean }>>;
  inspectRestore(): Promise<Result<RestorePreview | null>>;
  confirmRestore(input: { previewId: string }): Promise<Result<CoreState>>;
  cancelRestore(): Promise<Result<null>>;
  openDataFolder(): Promise<Result<null>>;
}
export class CoreError extends Error {
  constructor(
    public code: CoreErrorCode,
    message: string,
  ) {
    super(message);
  }
}
export function errorResult(error: unknown): Result<never> {
  if (error instanceof CoreError)
    return { ok: false, error: { code: error.code, message: error.message } };
  if (error instanceof z.ZodError)
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: error.issues[0]?.message ?? "Invalid input.",
      },
    };
  return {
    ok: false,
    error: {
      code: "STORAGE_UNAVAILABLE",
      message:
        "The change could not be saved. Check available disk space and folder permissions, then try again.",
    },
  };
}
