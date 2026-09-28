import { getWorkspaceContext } from "@/server/db/workspace";
import {
  describeGoogleNotebookProvider,
  probeGoogleNotebookProvider,
} from "@/server/notebooks/google-provider";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const shouldProbe = new URL(request.url).searchParams.get("probe") === "true";
  const status = shouldProbe
    ? await probeGoogleNotebookProvider()
    : describeGoogleNotebookProvider();
  return Response.json({ status });
}
