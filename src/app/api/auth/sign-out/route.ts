import { NextResponse } from "next/server";
import { clearLocalSession } from "@/server/auth/local";

export async function POST() {
  await clearLocalSession();
  return new NextResponse(null, {
    status: 303,
    headers: { location: "/sign-in" },
  });
}
