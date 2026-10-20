import { test } from "node:test";
import assert from "node:assert/strict";
import { shareArtwork } from "../src/domain/presentation";

test("share artwork honors stored catalogs and never upgrades unknown or mismatched identities", () => {
  assert.equal(shareArtwork({catalogVersion:"tigers-v1"})!.src, "/assets/tigers/pair-v1.png");
  assert.equal(shareArtwork({catalogVersion:"chunbae-v1",guide:"kim-chunbae-v1"})!.src, "/assets/chunbae-v1/reading.png");
  for (const input of [{}, {catalogVersion:"future"}, {catalogVersion:"chunbae-v1"},
    {catalogVersion:"chunbae-v1",guide:"https://untrusted.example/avatar"}])
    assert.equal(shareArtwork(input), null);
});
