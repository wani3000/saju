import { test } from "node:test";
import assert from "node:assert/strict";
import { readRequestBody } from "../src/server/request-body";
const encode = (s: string) => new TextEncoder().encode(s);
function request(chunks: Uint8Array[], headers: Record<string, string> = {}) {
  let read = 0,
    cancelled = false;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(c) {
        if (read === chunks.length) c.close();
        else c.enqueue(chunks[read++]);
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return {
    req: new Request("http://localhost", {
      method: "POST",
      body,
      headers,
      duplex: "half",
    } as RequestInit),
    read: () => read,
    cancelled: () => cancelled,
  };
}
test("stream limit counts UTF-8 bytes and stops before reading the remaining body", async () => {
  const r = request([
    encode("가".repeat(3000)),
    encode("나".repeat(3000)),
    encode("unread"),
  ]);
  await assert.rejects(readRequestBody(r.req), {
    code: "TOO_LARGE",
    status: 413,
  });
  assert.equal(r.read(), 2);
  assert.equal(r.cancelled(), true);
});
test("false small Content-Length does not bypass the streamed limit", async () => {
  const r = request([new Uint8Array(16385)], { "content-length": "1" });
  await assert.rejects(readRequestBody(r.req), { status: 413 });
});
test("declared large body is rejected before reading; exact limit is accepted", async () => {
  const r = request([encode("never read")], { "content-length": "20000" });
  await assert.rejects(readRequestBody(r.req), { status: 413 });
  assert.equal(r.read(), 0);
  assert.equal(
    (await readRequestBody(request([encode("a".repeat(16384))]).req)).length,
    16384,
  );
});
test("decodes UTF-8 split across chunks and rejects malformed encoding", async () => {
  const data = encode("가나다");
  assert.equal(
    await readRequestBody(request([data.slice(0, 2), data.slice(2)]).req),
    "가나다",
  );
  await assert.rejects(readRequestBody(request([new Uint8Array([0xff])]).req), {
    code: "INVALID_ENCODING",
  });
});
test("stalled upload times out and cancels the stream", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  const req = new Request("http://localhost", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(readRequestBody(req, 16384, 20), { status: 408 });
  assert.equal(cancelled, true);
});
