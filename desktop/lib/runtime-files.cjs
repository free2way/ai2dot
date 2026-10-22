const fs = require("node:fs");
const path = require("node:path");

function isEnvironmentFile(file) {
  const name = path.basename(file);
  return name === ".env" || name.startsWith(".env.");
}

function runtimeCopyFilter(source) {
  // Next standalone may contain the build machine's .env files. Never
  // distribute them, including files inside traced packages or public/.
  return !isEnvironmentFile(source);
}

function assertNoEnvironmentFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (isEnvironmentFile(file)) {
      throw new Error(`Desktop runtime contains an environment file: ${file}`);
    }
    if (entry.isDirectory()) assertNoEnvironmentFiles(file);
  }
}

module.exports = { runtimeCopyFilter, assertNoEnvironmentFiles };
