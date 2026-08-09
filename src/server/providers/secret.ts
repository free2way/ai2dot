import "server-only";

const VERSION = "v1";

function getEncryptionKey() {
  const encoded = process.env.PROVIDER_SECRET_ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error("PROVIDER_SECRET_ENCRYPTION_KEY is not configured.");
  }

  const bytes = Buffer.from(encoded, "base64");
  if (bytes.byteLength !== 32) {
    throw new Error("PROVIDER_SECRET_ENCRYPTION_KEY must decode to 32 bytes.");
  }
  return bytes;
}

async function importKey() {
  return crypto.subtle.importKey(
    "raw",
    getEncryptionKey(),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptProviderSecret(secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await importKey(),
    new TextEncoder().encode(secret),
  );

  return [
    VERSION,
    Buffer.from(iv).toString("base64url"),
    Buffer.from(cipher).toString("base64url"),
  ].join(":");
}

export async function decryptProviderSecret(encrypted: string) {
  const [version, encodedIv, encodedCipher] = encrypted.split(":");
  if (version !== VERSION || !encodedIv || !encodedCipher) {
    throw new Error("Unsupported encrypted provider secret.");
  }

  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(encodedIv, "base64url") },
    await importKey(),
    Buffer.from(encodedCipher, "base64url"),
  );

  return new TextDecoder().decode(plain);
}
