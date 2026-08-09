import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";

const catalogResponseSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string().min(1),
        name: z.string().optional(),
        description: z.string().optional(),
        context_window: z.number().int().positive().optional(),
        context_length: z.number().int().positive().optional(),
        max_model_len: z.number().int().positive().optional(),
        pricing: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
        architecture: z
          .object({ input_modalities: z.array(z.string()).optional() })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  ),
});

export type DiscoveredModel = {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  capabilities: string[];
  pricing?: Record<string, string>;
};

export function isPrivateNetworkAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (normalized.includes(":")) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized)
    );
  }

  const octets = normalized.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) {
    return true;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

export async function assertSafeProviderBaseUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Provider Base URL must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("Provider Base URL cannot contain credentials.");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Private provider addresses are not allowed.");
  }

  if (isIP(hostname)) {
    if (isPrivateNetworkAddress(hostname)) {
      throw new Error("Private provider addresses are not allowed.");
    }
    return;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (
    addresses.length === 0 ||
    addresses.some((entry) => isPrivateNetworkAddress(entry.address))
  ) {
    throw new Error("Provider hostname resolves to a private address.");
  }
}

function titleFromId(id: string) {
  const value = id.split("/").at(-1) ?? id;
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function parseProviderCatalog(payload: unknown): DiscoveredModel[] {
  const parsed = catalogResponseSchema.parse(payload);

  return parsed.data.map((model) => {
    const inputModalities = model.architecture?.input_modalities ?? ["text"];
    const capabilities = new Set<string>(["text"]);
    if (inputModalities.includes("image")) capabilities.add("image");
    if (inputModalities.some((item) => ["file", "pdf", "document"].includes(item))) {
      capabilities.add("files");
    }

    return {
      id: model.id,
      name: model.name || titleFromId(model.id),
      description: model.description,
      contextWindow:
        model.context_window ?? model.context_length ?? model.max_model_len,
      capabilities: [...capabilities],
      pricing: model.pricing
        ? Object.fromEntries(
            Object.entries(model.pricing).map(([key, value]) => [key, String(value)]),
          )
        : undefined,
    };
  });
}

export async function fetchProviderCatalog({
  type,
  baseUrl,
  secret,
}: {
  type: "gateway" | "openai_compatible" | "native";
  baseUrl?: string | null;
  secret?: string;
}) {
  const endpoint =
    type === "gateway"
      ? "https://ai-gateway.vercel.sh/v1/models"
      : `${baseUrl?.replace(/\/$/, "")}/models`;

  if (type !== "gateway" && !baseUrl) {
    throw new Error("This provider requires a base URL.");
  }

  if (type !== "gateway" && baseUrl) {
    await assertSafeProviderBaseUrl(baseUrl);
  }

  const response = await fetch(endpoint, {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Provider catalog request failed with ${response.status}.`);
  }

  return parseProviderCatalog(await response.json());
}
