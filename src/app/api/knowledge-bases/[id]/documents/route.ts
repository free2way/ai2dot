import { getWorkspaceContext } from "@/server/db/workspace";
import { addKnowledgeDocument } from "@/server/knowledge/store";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = /\.(txt|md|markdown|csv|json)$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getWorkspaceContext();
  if (!context) return Response.json({ message: "请先登录。" }, { status: 401 });
  const { id } = await params;
  const form = await request.formData();
  const file = form.get("file");
  const pastedContent = String(form.get("content") ?? "").trim();
  const pastedName = String(form.get("name") ?? "").trim();

  let name: string;
  let mimeType: string;
  let byteSize: number;
  let content: string;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ message: "单个文件不能超过 2MB。" }, { status: 413 });
    }
    if (!SUPPORTED_EXTENSIONS.test(file.name) && !file.type.startsWith("text/")) {
      return Response.json({ message: "当前支持 TXT、Markdown、CSV 和 JSON 文件。" }, { status: 415 });
    }
    name = file.name.slice(0, 160);
    mimeType = file.type || "text/plain";
    byteSize = file.size;
    content = await file.text();
  } else {
    if (!pastedName || !pastedContent) {
      return Response.json({ message: "请输入文档名称和正文。" }, { status: 400 });
    }
    name = pastedName.slice(0, 160);
    mimeType = "text/plain";
    byteSize = new TextEncoder().encode(pastedContent).byteLength;
    content = pastedContent;
  }

  try {
    const document = await addKnowledgeDocument(context, {
      knowledgeBaseId: id,
      name,
      mimeType,
      byteSize,
      content,
    });
    if (!document) return Response.json({ message: "知识库不存在。" }, { status: 404 });
    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "文档索引失败。" },
      { status: 400 },
    );
  }
}
