import { DatabaseSync } from "node:sqlite";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { checkDatabase, CREATE_REPORTS } from "./schema";
import { atomicWrite } from "./files";
export function migrateV1(
  db: DatabaseSync,
  root: string,
  beforeCommit?: () => void,
) {
  const workspaces = checkDatabase(db).map(({ id, name }) => ({ id, name }));
  const directory = mkdtempSync(join(root, "migration-"));
  const target = join(directory, "before.db");
  try {
    db.prepare("VACUUM INTO ?").run(target);
    const check = new DatabaseSync(target, { readOnly: true });
    try {
      checkDatabase(check);
    } finally {
      check.close();
    }
    const bytes = readFileSync(target);
    const backups = join(root, "backups");
    mkdirSync(backups, { recursive: true, mode: 0o700 });
    atomicWrite(
      join(backups, `before-schema-2-${randomUUID()}.creatorbackup`),
      JSON.stringify({
        format: "creator-desk-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        workspaces,
        database: {
          encoding: "base64",
          sha256: createHash("sha256").update(bytes).digest("hex"),
          bytes: bytes.length,
          content: bytes.toString("base64"),
        },
      }),
    );
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(CREATE_REPORTS);
      beforeCommit?.();
      db.exec("PRAGMA user_version=2; COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
