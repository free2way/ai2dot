type SummaryPart = { type: string; text?: string; finishReason?: string };

/** Negotiated framing lets clients distinguish partial text from completion. */
export function createSummaryResponse(
  stream: ReadableStream<SummaryPart>,
  framed: boolean,
  headers: Record<string, string>,
) {
  const encoder = new TextEncoder();
  let failed = false;
  let finished = false;
  let hasText = false;
  const error = { type: "error", code: "SUMMARY_FAILED", message: "模型总结失败，请稍后重试。" };
  const encodeEvent = (value: unknown) => encoder.encode(`${JSON.stringify(value)}\n`);
  const body = stream.pipeThrough(new TransformStream<SummaryPart, Uint8Array>({
    transform(part, controller) {
      if (failed) return;
      if (part.type === "error" || part.type === "abort" ||
          (part.type === "finish" && part.finishReason === "error")) {
        failed = true;
        if (framed) controller.enqueue(encodeEvent(error));
        else controller.error(new Error(error.message));
      } else if (part.type === "text-delta" && part.text) {
        hasText ||= part.text.trim().length > 0;
        controller.enqueue(framed
          ? encodeEvent({ type: "delta", text: part.text })
          : encoder.encode(part.text));
      } else if (part.type === "finish") {
        finished = true;
      }
    },
    flush(controller) {
      if (failed) return;
      if (!finished || !hasText) {
        if (framed) controller.enqueue(encodeEvent(error));
        else controller.error(new Error(error.message));
        return;
      }
      if (framed) controller.enqueue(encodeEvent({ type: "done" }));
    },
  }));
  return new Response(body, {
    headers: {
      ...headers,
      "content-type": framed ? "application/x-ndjson; charset=utf-8" : "text/plain; charset=utf-8",
    },
  });
}
