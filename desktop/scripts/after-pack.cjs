const fs = require("node:fs");
const path = require("node:path");

/**
 * electron-builder's extraResources filter drops node_modules, which the
 * Next.js standalone server needs. Copy the prepared runtime after packing
 * so the bundle keeps the exact directory layout that `server.js` expects.
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const productName = context.packager.appInfo.productFilename;
  const resourcesDir = path.join(
    context.appOutDir,
    `${productName}.app`,
    "Contents",
    "Resources",
  );
  const source = path.join(__dirname, "..", ".runtime");
  const destination = path.join(resourcesDir, "app");

  if (!fs.existsSync(path.join(source, "server.js"))) {
    throw new Error(`Prepared desktop runtime not found: ${source}`);
  }

  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true, force: true });

  for (const required of [
    "server.js",
    "desktop-start.mjs",
    "drizzle/meta/_journal.json",
    "node_modules/next/package.json",
    "node_modules/@electric-sql/pglite/dist/pglite.wasm",
  ]) {
    const target = path.join(destination, required);
    if (!fs.existsSync(target)) {
      throw new Error(`Packaged runtime is missing ${required}`);
    }
  }

  console.log(`[desktop:after-pack] runtime copied to ${destination}`);
};
