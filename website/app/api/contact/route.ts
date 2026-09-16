import { NextResponse } from "next/server";

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  teamSize?: unknown;
  interest?: unknown;
  details?: unknown;
  consent?: unknown;
  language?: unknown;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const name = clean(payload.name, 80);
  const email = clean(payload.email, 160);
  const company = clean(payload.company, 120);
  const teamSize = clean(payload.teamSize, 40);
  const interest = clean(payload.interest, 80);
  const details = clean(payload.details, 2000);
  const language = payload.language === "en" ? "en" : "zh";
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!name || !validEmail || !company || !teamSize || !interest || details.length < 20 || payload.consent !== "accepted") {
    return NextResponse.json(
      { message: language === "zh" ? "请检查所有必填信息。" : "Please check all required fields." },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !to || !from) {
    return NextResponse.json(
      { message: language === "zh" ? "商务邮箱尚未配置，请稍后再试。" : "The business inbox is not configured yet. Please try again later." },
      { status: 503 },
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject: `[AI2Dot Enterprise] ${company} - ${name}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Company: ${company}`,
        `Team size: ${teamSize}`,
        `Interest: ${interest}`,
        "",
        details,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { message: language === "zh" ? "提交失败，请稍后重试。" : "Submission failed. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
