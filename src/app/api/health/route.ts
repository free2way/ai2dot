export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", version: process.env.DEPLOYMENT_VERSION || process.env.AI2DOT_APP_VERSION || null });
}
