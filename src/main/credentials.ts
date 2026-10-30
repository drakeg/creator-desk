import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { CoreError } from "../shared/contracts";
import { atomicWrite } from "./storage/backups";
interface Protector {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}
const keySchema = z.string().regex(/^[a-z0-9-]{1,100}$/);
export class CredentialVault {
  private path: string;
  constructor(
    root: string,
    private protector: Protector,
  ) {
    this.path = join(root, "credentials.json");
  }
  private records() {
    return existsSync(this.path)
      ? z
          .record(z.string(), z.string())
          .parse(JSON.parse(readFileSync(this.path, "utf8")))
      : {};
  }
  private requireProtection() {
    if (!this.protector.isEncryptionAvailable())
      throw new CoreError(
        "STORAGE_UNAVAILABLE",
        "OS protected storage is unavailable. Unlock your system keyring and try again.",
      );
  }
  set(key: string, value: string) {
    keySchema.parse(key);
    z.string().min(1).max(64_000).parse(value);
    this.requireProtection();
    const records = this.records();
    records[key] = this.protector.encryptString(value).toString("base64");
    atomicWrite(this.path, JSON.stringify(records));
  }
  has(key: string) {
    keySchema.parse(key);
    return Boolean(this.records()[key]);
  }
  delete(key: string) {
    keySchema.parse(key);
    const records = this.records();
    delete records[key];
    atomicWrite(this.path, JSON.stringify(records));
  }
  get(key: string) {
    keySchema.parse(key);
    this.requireProtection();
    const record = this.records()[key];
    return record
      ? this.protector.decryptString(Buffer.from(record, "base64"))
      : null;
  }
}
