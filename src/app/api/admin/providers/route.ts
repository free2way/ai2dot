import { z } from "zod";
import { getAdminWorkspaceContext } from "@/server/db/workspace";
import {
  createProviderConnection,
  listProviderConnections,
  listProviderModels,
} from "@/server/providers/store";
import { getWorkspaceOperations } from "@/server/operations/store";

const providerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    type: z.literal("openai_compatible"),
    baseUrl: z.string().url(),
    secret: z.string().trim().min(1).max(4_000),
  })
  .refine((value) => Boolean(value.baseUrl), {
    path: ["baseUrl"],
    message: "模型供应商必须填写 Base URL。",
  });

export async function GET() {
  const context = await getAdminWorkspaceContext();
  if (!context) return Response.json({ code: "FORBIDDEN" }, { status: 403 });

  const [providers, models, operations] = await Promise.all([
    listProviderConnections(context),
    listProviderModels(context),
    getWorkspaceOperations(context),
  ]);
  return Response.json({ providers, models, operations });
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
