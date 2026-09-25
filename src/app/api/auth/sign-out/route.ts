import { NextResponse } from "next/server";
import { clearLocalSession } from "@/server/auth/local";

export async function POST(request: Request) {
  await clearLocalSession();
  return NextResponse.redirect(new URL("/sign-in", request.url), 303);
}
