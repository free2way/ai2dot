import { randomBytes, scryptSync } from "node:crypto";
import process from "node:process";
import postgres from "postgres";

const username = (process.argv[2] ?? "").trim().toLowerCase();
if (!username || username.length > 100) {
  console.error("Usage: npm run admin:create -- <username>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}
if (!process.stdin.isTTY) {
  console.error("This command requires an interactive terminal.");
  process.exit(1);
}

function readHidden(prompt) {
  return new Promise((resolve) => {
    let value = "";
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") process.exit(130);
        if (character === "\r" || character === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (character === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

const password = await readHidden("Password: ");
if (password.length < 10 || password.length > 1_024) {
  console.error("Password must be between 10 and 1024 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const digest = scryptSync(password, salt, 32, {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});
const passwordHash = `scrypt$${salt.toString("base64url")}$${digest.toString("base64url")}`;
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

try {
  await sql.begin(async (transaction) => {
    const [admin] = await transaction`
      insert into platform_admins (
        username,
        display_name,
        password_hash,
        role,
        status,
        failed_login_count,
        password_changed_at,
        created_at,
        updated_at
      ) values (
        ${username},
        ${username},
        ${passwordHash},
        'super_admin',
        'active',
        0,
        now(),
        now(),
        now()
      )
      on conflict (username) do update set
        password_hash = excluded.password_hash,
        role = 'super_admin',
        status = 'active',
        failed_login_count = 0,
        locked_until = null,
        password_changed_at = now(),
        updated_at = now()
      returning id
    `;
    await transaction`
      delete from platform_admin_sessions where admin_id = ${admin.id}
    `;
  });
  console.log(`Platform administrator ${username} is ready.`);
} finally {
  await sql.end();
}
