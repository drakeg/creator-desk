import { backup, DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  readSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  CoreError,
  type RestorePreview,
  workspaceName,
} from "../../shared/contracts";
import { Store } from "./store";
import { checkDatabase } from "./schema";

const MAX_FILE = 32 * 1024 * 1024;
const MAX_DB = 24 * 1024 * 1024;
const manifestSchema = z
  .object({
    format: z.literal("creator-desk-backup"),
    version: z.literal(1),
    createdAt: z.iso.datetime(),
    workspaces: z
      .array(z.object({ id: z.uuid(), name: workspaceName }).strict())
      .max(1000),
    database: z
      .object({
        encoding: z.literal("base64"),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        bytes: z.number().int().positive().max(MAX_DB),
        content: z
          .string()
          .max(MAX_FILE)
          .regex(
            /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
          ),
      })
      .strict(),
  })
  .strict();
const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
export { atomicWrite } from "./files";
import { atomicWrite } from "./files";
interface StagedRestore {
  directory: string;
  path: string;
  preview: RestorePreview;
  hash: string;
  revision: number;
  expires: number;
}
export class Backups {
  private staged: StagedRestore | null = null;
  constructor(
    private store: Store,
    private beforeActivation?: () => void,
  ) {}
  async export(destination: string) {
    if (!destination.endsWith(".creatorbackup"))
      throw new CoreError("INVALID_INPUT", "Use a .creatorbackup filename.");
    const directory = mkdtempSync(join(this.store.root, "snapshot-"));
    try {
      const path = join(directory, "snapshot.db");
      await backup(this.store.db, path);
      const content = readFileSync(path);
      if (content.length > MAX_DB)
        throw new CoreError(
          "INVALID_BACKUP",
          "The database exceeds this version’s 24 MB backup limit.",
        );
      const database = new DatabaseSync(path, { readOnly: true });
      let workspaces;
      try {
        workspaces = checkDatabase(database).map(({ id, name }) => ({
          id,
          name,
        }));
      } finally {
        database.close();
      }
      const payload = {
        format: "creator-desk-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        workspaces,
        database: {
          encoding: "base64",
          sha256: hash(content),
          bytes: content.length,
          content: content.toString("base64"),
        },
      };
      atomicWrite(destination, JSON.stringify(payload));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
  inspect(path: string): RestorePreview {
    this.cancel();
    let directory: string | undefined;
    try {
      const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      let encoded: string;
      try {
        const metadata = fstatSync(fd);
        if (!metadata.isFile() || metadata.size > MAX_FILE)
          throw new Error("File size/type");
        const bounded = Buffer.alloc(metadata.size + 1);
        let offset = 0;
        while (offset < bounded.length) {
          const read = readSync(
            fd,
            bounded,
            offset,
            bounded.length - offset,
            null,
          );
          if (read === 0) break;
          offset += read;
        }
        if (offset !== metadata.size)
          throw new Error("File changed while reading");
        encoded = bounded.subarray(0, offset).toString("utf8");
      } finally {
        closeSync(fd);
      }
      const manifest = manifestSchema.parse(JSON.parse(encoded));
      const content = Buffer.from(manifest.database.content, "base64");
      if (
        content.length !== manifest.database.bytes ||
        hash(content) !== manifest.database.sha256 ||
        content.subarray(0, 16).toString() !== "SQLite format 3\0"
      )
        throw new Error("Invalid database bytes");
      directory = mkdtempSync(join(this.store.root, "restore-"));
      const stagedPath = join(directory, "validated.db");
      atomicWrite(stagedPath, content);
      const db = new DatabaseSync(stagedPath, { readOnly: true });
      let workspaces;
      try {
        workspaces = checkDatabase(db).map(({ id, name }) => ({ id, name }));
      } finally {
        db.close();
      }
      if (
        JSON.stringify(
          workspaces.slice().sort((a, b) => a.id.localeCompare(b.id)),
        ) !==
        JSON.stringify(
          manifest.workspaces.slice().sort((a, b) => a.id.localeCompare(b.id)),
        )
      )
        throw new Error("Workspace manifest mismatch");
      const preview = {
        previewId: randomUUID(),
        createdAt: manifest.createdAt,
        workspaces,
      };
      this.staged = {
        directory,
        path: stagedPath,
        preview,
        hash: manifest.database.sha256,
        revision: this.store.revision,
        expires: Date.now() + 15 * 60_000,
      };
      return preview;
    } catch {
      if (directory) rmSync(directory, { recursive: true, force: true });
      throw new CoreError(
        "INVALID_BACKUP",
        "This backup is damaged, unsupported, or exceeds the 32 MB file limit. Your current data has not changed.",
      );
    }
  }
  async restore(previewId: string, now = Date.now()) {
    const staged = this.staged;
    if (!staged || staged.preview.previewId !== previewId)
      throw new CoreError(
        "INVALID_BACKUP",
        "Choose and preview the backup again.",
      );
    if (now > staged.expires) {
      this.cancel();
      throw new CoreError(
        "INVALID_BACKUP",
        "The backup preview expired. Choose the file again.",
      );
    }
    if (staged.revision !== this.store.revision) {
      this.cancel();
      throw new CoreError(
        "INVALID_BACKUP",
        "Your data changed after the preview. Choose the backup again.",
      );
    }
    if (hash(readFileSync(staged.path)) !== staged.hash) {
      this.cancel();
      throw new CoreError(
        "INVALID_BACKUP",
        "The staged backup changed. Choose the file again.",
      );
    }
    const backupRoot = join(this.store.root, "backups");
    mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
    const recoveryFile = join(
      backupRoot,
      `before-restore-${Date.now()}-${randomUUID()}.creatorbackup`,
    );
    await this.export(recoveryFile);
    // Keep a verified rollback snapshot until the replacement successfully opens.
    const payload = manifestSchema.parse(
      JSON.parse(readFileSync(recoveryFile, "utf8")),
    );
    const rollback = join(staged.directory, "rollback.db");
    writeFileSync(rollback, Buffer.from(payload.database.content, "base64"), {
      mode: 0o600,
      flag: "wx",
    });
    this.store.close();
    let replaced = false;
    try {
      // Both files are on the app's volume; POSIX rename replaces atomically.
      renameSync(staged.path, this.store.path);
      replaced = true;
      this.beforeActivation?.();
      this.store.open();
      this.store.revision++;
    } catch (error) {
      this.store.close();
      if (replaced) renameSync(rollback, this.store.path);
      this.store.open();
      throw error;
    } finally {
      this.cancel();
    }
    return this.store.state();
  }
  cancel() {
    if (this.staged) {
      rmSync(this.staged.directory, { recursive: true, force: true });
      this.staged = null;
    }
  }
}
