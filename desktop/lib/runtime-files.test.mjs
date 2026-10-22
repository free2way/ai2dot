import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import runtimeFiles from "./runtime-files.cjs";

const { runtimeCopyFilter, assertNoEnvironmentFiles } = runtimeFiles;
const directories = [];

function temporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ai2dot-runtime-test-"));
  directories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("desktop runtime packaging", () => {
  it("excludes build secrets from standalone, public and nested dependencies", () => {
    const source = temporaryDirectory();
    const destination = temporaryDirectory();
    const files = [
      ".env", ".env.production", ".env.local", ".env.production.local",
      "public/.env", "node_modules/example/.env.production",
      "server.js", "node_modules/example/index.js", "public/icon.svg",
      "node_modules/@next/env/package.json",
    ];
    for (const file of files) {
      const target = path.join(source, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, "dummy fixture");
    }

    fs.cpSync(source, destination, { recursive: true, filter: runtimeCopyFilter });

    expect(() => assertNoEnvironmentFiles(destination)).not.toThrow();
    for (const file of files) {
      expect(fs.existsSync(path.join(destination, file))).toBe(
        !path.basename(file).startsWith(".env"),
      );
    }
  });

  it("fails the verification if a later step adds an environment file", () => {
    const directory = temporaryDirectory();
    fs.mkdirSync(path.join(directory, "nested"));
    fs.writeFileSync(path.join(directory, "nested", ".env.production"), "dummy");
    expect(() => assertNoEnvironmentFiles(directory)).toThrow("environment file");
  });
});
