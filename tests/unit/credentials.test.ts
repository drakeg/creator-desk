import { afterEach, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CredentialVault } from "../../src/main/credentials";
const roots: string[] = [];
afterEach(() => {
  roots.forEach((r) => rmSync(r, { recursive: true, force: true }));
  roots.length = 0;
});
it("refuses to save secrets without protected storage", () => {
  const root = mkdtempSync(join(tmpdir(), "vault-"));
  roots.push(root);
  const vault = new CredentialVault(root, {
    isEncryptionAvailable: () => false,
    encryptString: () => {
      throw new Error();
    },
    decryptString: () => "",
  });
  expect(() => vault.set("youtube-account", "private-token")).toThrow(
    /protected storage/,
  );
});
it("persists encrypted payloads and decrypts only through the main-process service", () => {
  const root = mkdtempSync(join(tmpdir(), "vault-"));
  roots.push(root);
  const protector = {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(s.split("").reverse().join("")),
    decryptString: (b: Buffer) => b.toString().split("").reverse().join(""),
  };
  new CredentialVault(root, protector).set("youtube-account", "private-token");
  expect(readFileSync(join(root, "credentials.json"), "utf8")).not.toContain(
    "private-token",
  );
  expect(new CredentialVault(root, protector).get("youtube-account")).toBe(
    "private-token",
  );
});
