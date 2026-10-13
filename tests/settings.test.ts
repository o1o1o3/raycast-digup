import test from "node:test";
import assert from "node:assert/strict";
import { parsePreferences } from "../src/lib/settings";
test("reads folders even when macOS preferences include dates and binary data", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>
 <key>roots</key><array><string>/Users/test/My &amp; Work</string></array>
 <key>codeRoots</key><array/>
 <key>SULastCheckTime</key><date>2026-10-13T10:00:00Z</date>
 <key>NSWindowState</key><data>YWJj</data>
 </dict></plist>`;
  const prefs = parsePreferences(xml);
  assert.deepEqual(prefs.roots, ["/Users/test/My & Work"]);
  assert.deepEqual(prefs.codeRoots, []);
});
