import fs from "node:fs";
import { assertComponent, parseVersion } from "./lib.mjs";

const component = assertComponent(process.argv[2]);
const version = process.argv[3];
parseVersion(version);
const prefix = component === "extension" ? "extension/" : "";
for (const name of ["package.json", "package-lock.json"]) {
  const file = `${prefix}${name}`;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.version = version;
  if (data.packages?.[""]) data.packages[""].version = version;
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}
console.log(`Prepared ${component} ${version}; version changes are build-local only.`);
