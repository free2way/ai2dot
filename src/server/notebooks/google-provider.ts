import "server-only";

import type { GoogleNotebookProviderStatus } from "@/lib/notebooks";

const supportedLocations = new Set([
  "global",
  "us",
  "eu",
  "ca",
  "in",
  "asia-northeast1",
  "sg",
  "europe-west2",
]);

type GoogleNotebookEnvironment = {
  [key: string]: string | undefined;
  AI2DOT_ENABLE_GOOGLE_NOTEBOOK_PROVIDER?: string;
  AI2DOT_DEPLOYMENT_REGION?: string;
  GOOGLE_NOTEBOOK_PROJECT_NUMBER?: string;
  GOOGLE_NOTEBOOK_LOCATION?: string;
  GOOGLE_NOTEBOOK_ACCESS_TOKEN?: string;
  GOOGLE_NOTEBOOK_CLIENT_ID?: string;
  GOOGLE_NOTEBOOK_CLIENT_SECRET?: string;
};

export function getGoogleNotebookProviderConfig(
  environment: GoogleNotebookEnvironment = process.env,
) {
  const enabled = environment.AI2DOT_ENABLE_GOOGLE_NOTEBOOK_PROVIDER === "true";
  const deploymentRegion = environment.AI2DOT_DEPLOYMENT_REGION?.trim() || "unknown";
  const dataLocation = environment.GOOGLE_NOTEBOOK_LOCATION?.trim() || null;
  const projectConfigured = Boolean(environment.GOOGLE_NOTEBOOK_PROJECT_NUMBER?.trim());
  const credentialsConfigured = Boolean(
    environment.GOOGLE_NOTEBOOK_ACCESS_TOKEN?.trim() ||
      (environment.GOOGLE_NOTEBOOK_CLIENT_ID?.trim() &&
        environment.GOOGLE_NOTEBOOK_CLIENT_SECRET?.trim()),
  );
  const regionSupported = Boolean(dataLocation && supportedLocations.has(dataLocation));
  return {
    enabled,
    deploymentRegion,
    dataLocation,
    projectConfigured,
    credentialsConfigured,
    regionSupported,
    mainlandChinaDeployment: ["cn", "cn-mainland", "china-mainland"].includes(
      deploymentRegion.toLowerCase(),
    ),
    configured:
      enabled && projectConfigured && credentialsConfigured && regionSupported,
  };
}

function endpointForLocation(location: string) {
  if (location === "us" || location === "eu") {
    return `https://${location}-discoveryengine.googleapis.com`;
  }
  return "https://discoveryengine.googleapis.com";
}

export function describeGoogleNotebookProvider(
  environment: GoogleNotebookEnvironment = process.env,
): GoogleNotebookProviderStatus {
  const config = getGoogleNotebookProviderConfig(environment);
  let message = "Google Provider 已关闭，本地研究空间不受影响。";
  if (config.enabled && !config.projectConfigured) {
    message = "缺少 Google Cloud Project Number。";
  } else if (config.enabled && !config.dataLocation) {
    message = "缺少 Gemini Notebook Enterprise 数据位置。";
  } else if (config.enabled && !config.regionSupported) {
    message = "所选数据位置不在 Google 当前支持列表中。";
  } else if (config.enabled && !config.credentialsConfigured) {
    message = "缺少用户 OAuth 凭据或临时访问令牌。";
  } else if (config.configured) {
    message = config.mainlandChinaDeployment
      ? "配置完整；中国境内部署仍需验证 Google API 出口、企业许可证和跨境数据合规。"
      : "配置完整，等待连通性和授权验证。";
  }
  return {
    ...config,
    network: "not_checked",
    authorization: "not_checked",
    checkedAt: null,
    message,
  };
}

export async function probeGoogleNotebookProvider(
  environment: GoogleNotebookEnvironment = process.env,
): Promise<GoogleNotebookProviderStatus> {
  const status = describeGoogleNotebookProvider(environment);
  if (!status.enabled || !status.projectConfigured || !status.dataLocation || !status.regionSupported) {
    return status;
  }

  const projectNumber = environment.GOOGLE_NOTEBOOK_PROJECT_NUMBER!.trim();
  const endpoint = endpointForLocation(status.dataLocation);
  const url = `${endpoint}/v1alpha/projects/${encodeURIComponent(projectNumber)}/locations/${encodeURIComponent(status.dataLocation)}/notebooks`;
  const token = environment.GOOGLE_NOTEBOOK_ACCESS_TOKEN?.trim();
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    const reachable = response.status > 0;
    const authorized = response.ok;
    return {
      ...status,
      network: reachable ? "reachable" : "unreachable",
      authorization: authorized ? "unknown" : "required",
      checkedAt: new Date().toISOString(),
      message: authorized
        ? "Google API 可达且请求已通过基础授权验证。"
        : response.status === 401 || response.status === 403
          ? "Google API 可达，但仍需有效用户授权、IAM 角色和 Enterprise 许可证。"
          : `Google API 可达，返回 HTTP ${response.status}；请核对项目、位置和 API 状态。`,
    };
  } catch (error) {
    return {
      ...status,
      network: "unreachable",
      authorization: "not_checked",
      checkedAt: new Date().toISOString(),
      message: `无法从当前服务器连接 Google API：${error instanceof Error ? error.message : "网络错误"}`,
    };
  }
}
