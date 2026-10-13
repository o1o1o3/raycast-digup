import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedPath,
  parseHits,
  locationLabel,
  editorTarget,
  type SearchHit,
} from "../src/lib/results";

test("opens the exact matching line instead of the enclosing segment start", () => {
  const focused = { ...hit, focus: 25 };
  assert.equal(locationLabel(focused), "Line 25");
  assert.equal(
    editorTarget(focused, "vscode"),
    "vscode://file/work/my%20project/a%23b%3F.ts:25:1",
  );
});
const hit: SearchHit = {
  path: "/work/my project/a#b?.ts",
  kind: "code",
  segment: "code",
  segment_id: 1,
  score: 0.9,
  loc: 12,
};
test("scope respects folder boundaries, exclusions and an empty scope", () => {
  assert.equal(allowedPath("/work/repo/a.ts", ["/work/repo"], []), true);
  assert.equal(allowedPath("/work/repository/a.ts", ["/work/repo"], []), false);
  assert.equal(
    allowedPath(
      "/work/repo/private/a.ts",
      ["/work/repo"],
      ["/work/repo/private"],
    ),
    false,
  );
  assert.equal(allowedPath("/work/repo/a.ts", [], []), false);
  assert.equal(
    allowedPath("/work/repo/../outside/a.ts", ["/work/repo"], []),
    false,
  );
});
test("rejects malformed results and excludes results outside configured folders", () => {
  const result = parseHits(
    {
      hits: [
        hit,
        { ...hit, path: "/other/a.ts" },
        null,
        { path: "/work/a.ts" },
        { ...hit, segment_id: "bad" },
      ],
    },
    ["/work"],
    [],
  );
  assert.deepEqual(result, [hit]);
});
test("file locations distinguish lines, pages and media timestamps", () => {
  assert.equal(locationLabel(hit), "Line 12");
  assert.equal(
    locationLabel({ ...hit, kind: "pdf", segment: "pdfPage", loc: 3 }),
    "Page 3",
  );
  assert.equal(
    locationLabel({ ...hit, kind: "audio", segment: "audio", loc: 65 }),
    "1:05",
  );
});
test("editor links encode path characters and include the matching line", () => {
  assert.equal(
    editorTarget(hit, "vscode"),
    "vscode://file/work/my%20project/a%23b%3F.ts:12:1",
  );
  assert.equal(editorTarget(hit, "default"), "/work/my project/a#b?.ts");
});
