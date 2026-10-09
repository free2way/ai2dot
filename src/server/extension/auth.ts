import "server-only";

import { auth } from "@clerk/nextjs/server";
import { getAuthMode } from "@/server/auth/config";
import { getWorkspaceContext } from "@/server/db/workspace";

type ExtensionAuthErrorCode =
  | "EXTENSION_AUTH_UNAVAILABLE"
  | "EXTENSION_NOT_CONFIGURED"
  | "EXTENSION_ORIGIN_FORBIDDEN"
  | "EXTENSION_UNAUTHENTICATED";

type ExtensionAuthResult =
  | {
      ok: true;
      extensionId: string;
      externalAuthId: string;
      sessionId: string | null;
    }
  | {
      ok: false;
      code: ExtensionAuthErrorCode;
      status: 401 | 403 | 503;
      message: string;
    };

export function getAllowedChromeExtensionIds() {
  return new Set(
    (process.env.AI2DOT_CHROME_EXTENSION_IDS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function parseChromeExtensionOrigin(origin: string | null) {
  if (!origin) return null;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "chrome-extension:" || !parsed.hostname) {
      return null;
    }
    return {
      extensionId: parsed.hostname.toLowerCase(),
      origin: `${parsed.protocol}//${parsed.hostname.toLowerCase()}`,
    };
  } catch {
    return null;
  }
}

export async function authenticateChromeExtension(
  request: Request,
): Promise<ExtensionAuthResult> {
  if (getAuthMode() !== "clerk") {
    return {
      ok: false,
      code: "EXTENSION_AUTH_UNAVAILABLE",
      status: 503,
      message: "Chrome 扩展认证仅在 Clerk 模式下可用。",
    };
  }

  const allowedIds = getAllowedChromeExtensionIds();
  if (allowedIds.size === 0) {
    return {
      ok: false,
      code: "EXTENSION_NOT_CONFIGURED",
      status: 503,
      message: "服务端尚未配置允许的 Chrome 扩展 ID。",
    };
  }

  const extension = parseChromeExtensionOrigin(request.headers.get("origin"));
  if (!extension || !allowedIds.has(extension.extensionId)) {
    return {
      ok: false,
      code: "EXTENSION_ORIGIN_FORBIDDEN",
      status: 403,
      message: "当前 Chrome 扩展来源未获授权。",
    };
  }

  const authState = await auth();
  if (!authState.userId) {
    return {
      ok: false,
      code: "EXTENSION_UNAUTHENTICATED",
      status: 401,
      message: "请先登录 ai2dot。",
    };
  }

  const claims = authState.sessionClaims as { azp?: string } | null;
  if (claims?.azp && claims.azp !== extension.origin) {
    return {
      ok: false,
      code: "EXTENSION_ORIGIN_FORBIDDEN",
      status: 403,
      message: "会话来源与当前 Chrome 扩展不匹配。",
    };
  }

  return {
    ok: true,
    extensionId: extension.extensionId,
    externalAuthId: authState.userId,
    sessionId: authState.sessionId,
  };
}

export async function getChromeExtensionWorkspaceContext(request: Request) {
  const identity = await authenticateChromeExtension(request);
  if (!identity.ok) return identity;

  const context = await getWorkspaceContext();
  if (!context) {
    return {
      ok: false as const,
      code: "EXTENSION_UNAUTHENTICATED" as const,
      status: 401 as const,
      message: "无法加载用户工作区。",
    };
  }

  return { ok: true as const, identity, context };
}

export function extensionAuthErrorResponse(
  result: Extract<ExtensionAuthResult, { ok: false }> | {
    ok: false;
    code: string;
    status: number;
    message: string;
  },
) {
  return Response.json(
    { code: result.code, message: result.message },
    { status: result.status },
  );
}
