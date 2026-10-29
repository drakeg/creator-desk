import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  appearance,
  appearanceInput,
  CoreError,
  idInput,
  nameInput,
  renameInput,
  sidebarInput,
  type CoreState,
  type Workspace,
} from "../../shared/contracts";

export { checkDatabase, SCHEMA_VERSION } from "./schema";
import { checkDatabase, SCHEMA_VERSION, CREATE_REPORTS } from "./schema";
import { migrateV1 } from "./migrations";
const workspaceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export class Store {
  db!: DatabaseSync;
  readonly path: string;
  private closed = true;
  private depth = 0;
  revision = 0;
  constructor(
    readonly root: string,
    private beforeMigration?: () => void,
  ) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    this.path = join(root, "creator.db");
    this.open();
  }
  open() {
    this.db = new DatabaseSync(this.path);
    this.closed = false;
    try {
      this.db.exec("PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON;");
      const version = Number(
        this.db.prepare("PRAGMA user_version").get()?.user_version,
      );
      if (version > SCHEMA_VERSION)
        throw new CoreError(
          "UNSUPPORTED_VERSION",
          "Your database was created by a newer version of Creator Desk. Update the app to open it.",
        );
      if (version === 0) {
        if (this.db.prepare("SELECT name FROM sqlite_schema").all().length)
          throw new CoreError(
            "UNSUPPORTED_VERSION",
            "This database format is not supported. Your data has been preserved.",
          );
        this.db
          .exec(`BEGIN; CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL) STRICT;
          CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT; ${CREATE_REPORTS} PRAGMA user_version=2; COMMIT;`);
      }
      if (version === 1) migrateV1(this.db, this.root, this.beforeMigration);
      checkDatabase(this.db);
      this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
      chmodSync(this.path, 0o600);
    } catch (error) {
      this.close();
      throw error;
    }
  }
  close() {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }
  transaction<T>(fn: () => T): T {
    if (this.depth) return fn();
    this.db.exec("BEGIN IMMEDIATE");
    this.depth++;
    try {
      const result = fn();
      this.db.exec("COMMIT");
      this.revision++;
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    } finally {
      this.depth--;
    }
  }
  setting<T>(key: string, fallback: T): T {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key=?")
      .get(key);
    return row ? (JSON.parse(String(row.value)) as T) : fallback;
  }
  private put(key: string, value: unknown) {
    this.db
      .prepare(
        "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, JSON.stringify(value));
  }
  state(): CoreState {
    const workspaces = this.db
      .prepare(
        "SELECT id,name,created_at AS createdAt,updated_at AS updatedAt FROM workspaces ORDER BY created_at,id",
      )
      .all()
      .map((w) => workspaceSchema.parse(w));
    return {
      workspaces,
      selectedWorkspaceId: this.setting<string | null>(
        "selectedWorkspaceId",
        null,
      ),
      appearance: appearance.parse(this.setting("appearance", "system")),
      sidebarCollapsed: this.setting("sidebarCollapsed", false),
      dataLocation: this.root,
      version: "0.4.0",
    };
  }
  create(input: unknown): Workspace {
    const { name } = nameInput.parse(input);
    if (this.state().workspaces.length >= 1000)
      throw new CoreError(
        "INVALID_INPUT",
        "The workspace limit has been reached.",
      );
    const time = new Date().toISOString();
    const w = { id: randomUUID(), name, createdAt: time, updatedAt: time };
    return this.transaction(() => {
      this.db
        .prepare("INSERT INTO workspaces VALUES (?,?,?,?)")
        .run(w.id, name, time, time);
      this.put("selectedWorkspaceId", w.id);
      return w;
    });
  }
  select(input: unknown) {
    const { id } = idInput.parse(input);
    this.requireWorkspace(id);
    this.transaction(() => this.put("selectedWorkspaceId", id));
    return this.state();
  }
  rename(input: unknown): Workspace {
    const { id, name } = renameInput.parse(input);
    this.requireWorkspace(id);
    this.transaction(() =>
      this.db
        .prepare("UPDATE workspaces SET name=?,updated_at=? WHERE id=?")
        .run(name, new Date().toISOString(), id),
    );
    return this.requireWorkspace(id);
  }
  private requireWorkspace(id: string) {
    const w = this.state().workspaces.find((w) => w.id === id);
    if (!w)
      throw new CoreError("NOT_FOUND", "That workspace could not be found.");
    return w;
  }
  setAppearance(input: unknown) {
    const { mode } = appearanceInput.parse(input);
    this.transaction(() => this.put("appearance", mode));
    return this.state();
  }
  setSidebar(input: unknown) {
    const { collapsed } = sidebarInput.parse(input);
    this.transaction(() => this.put("sidebarCollapsed", collapsed));
    return this.state();
  }
  saveWindowBounds(bounds: { width: number; height: number }) {
    this.transaction(() => this.put("windowBounds", bounds));
  }
}
