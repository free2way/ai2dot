import { z } from "zod";
import { getAdminWorkspaceContext } from "@/server/db/workspace";
import {
  createProviderConnection,
  listProviderConnections,
  listProviderModels,
} from "@/server/providers/store";

const providerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    type: z.enum(["gateway", "openai_compatible", "native"]),
    baseUrl: z.string().url().optional().or(z.literal("")),
    secret: z.string().trim().max(4_000).optional(),
  })
  .refine((value) => value.type === "gateway" || Boolean(value.baseUrl), {
    path: ["baseUrl"],
    message: "自定义供应商必须填写 Base URL。",
  });

export async function GET() {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });

  const [providers, models] = await Promise.all([
    listProviderConnections(context),
    listProviderModels(context),
  ]);
  return Response.json({ providers, models });
}

export async function POST(request: Request) {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });

  const parsed = providerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_REQUEST", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const connection = await createProviderConnection(context, parsed.data);
    return Response.json({ connection }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        code: "PROVIDER_SETUP_FAILED",
        message: error instanceof Error ? error.message : "供应商保存失败。",
      },
      { status: 503 },
    );
  }
}
