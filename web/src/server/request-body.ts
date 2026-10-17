import { AppError } from "../domain/model";

// Apply the byte limit while receiving chunks, before decoding or parsing them.
// Content-Length is only an early rejection hint, never the source of truth.
export async function readRequestBody(
  req: Request,
  limit = 16384,
  timeoutMs = 10000,
): Promise<string> {
  const length = req.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) {
    void req.body?.cancel().catch(() => {});
    throw new AppError(
      "TOO_LARGE",
      413,
      "요청 내용이 너무 커요. 입력을 확인해 주세요.",
    );
  }
  if (!req.body) return "";
  const reader = req.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        let size = 0;
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > limit)
            throw new AppError(
              "TOO_LARGE",
              413,
              "요청 내용이 너무 커요. 입력을 확인해 주세요.",
            );
          chunks.push(value);
        }
        try {
          return new TextDecoder("utf-8", { fatal: true }).decode(
            Buffer.concat(chunks, size),
          );
        } catch {
          throw new AppError("INVALID_ENCODING", 400);
        }
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new AppError(
                "REQUEST_TIMEOUT",
                408,
                "요청 시간이 지났어요. 다시 시도해 주세요.",
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
