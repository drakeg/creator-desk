import {
  existsSync,
  constants,
  lstatSync,
  fstatSync,
  writeFileSync,
  openSync,
  fsyncSync,
  closeSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
export function atomicWrite(destination: string, bytes: string | Buffer) {
  const temporary = join(
    dirname(destination),
    `.creator-write-${randomUUID()}`,
  );
  try {
    writeFileSync(temporary, bytes, { mode: 0o600, flag: "wx" });
    const fd = openSync(temporary, "r+");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, destination);
  } finally {
    if (existsSync(temporary)) rmSync(temporary);
  }
}

// Windows has no O_NOFOLLOW: reject links before opening and verify the handle identity.
export function openRegularFile(path: string, maxBytes: number): number {
  const before = lstatSync(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size > maxBytes)
    throw new Error("Choose a regular file within the size limit.");
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd);
    if (
      !opened.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size
    )
      throw new Error("The selected file changed.");
    return fd;
  } catch (error) {
    closeSync(fd);
    throw error;
  }
}
