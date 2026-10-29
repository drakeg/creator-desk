import {
  existsSync,
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
    const fd = openSync(temporary, "r");
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
