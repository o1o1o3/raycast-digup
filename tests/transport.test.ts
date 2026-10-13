import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { ServiceClient } from "../src/lib/service";
import { setTimeout as sleep } from "node:timers/promises";

test("closing terminates an owned descendant process as well as the helper", async () => {
  const c = client();
  let pid: number | undefined;
  try {
    pid = (await c.request({ op: "descendant" })).pid as number;
    c.close();
    let alive = true;
    for (let i = 0; i < 45; i++) {
      await sleep(100);
      try {
        process.kill(pid, 0);
      } catch {
        alive = false;
        break;
      }
    }
    assert.equal(alive, false, "encoder child must not outlive its command");
  } finally {
    c.close();
    if (pid) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* Already exited. */
      }
    }
  }
});

function client(timeoutMs = 1000) {
  return new ServiceClient(process.execPath, [resolve("tests/helper.mjs")], {
    timeoutMs,
  });
}
test("assembles fragmented JSON and ignores startup events", async () => {
  const c = client();
  try {
    assert.equal(
      (await c.request({ op: "split", q: "привет\nworld" })).value,
      "привет\nworld",
    );
  } finally {
    c.close();
  }
});
test("correlates responses that arrive in reverse order", async () => {
  const c = client();
  try {
    const a = c.request({ op: "search", q: "first", delay: 30 });
    const b = c.request({ op: "search", q: "second" });
    assert.equal((await b).value, "second");
    assert.equal((await a).value, "first");
  } finally {
    c.close();
  }
});
test("surfaces the helper's reported failure", async () => {
  const c = client();
  try {
    await assert.rejects(c.request({ op: "error" }), /Index unavailable/);
  } finally {
    c.close();
  }
});
test("rejects on process exit instead of loading forever", async () => {
  const c = client();
  try {
    await assert.rejects(c.request({ op: "exit" }), /exited/);
  } finally {
    c.close();
  }
});
test("timeout ends the unresponsive process and fails future calls", async () => {
  const c = client(120);
  try {
    await assert.rejects(c.request({ op: "hang" }), /timed out/);
    await assert.rejects(c.request({ op: "search" }), /timed out|closed/);
  } finally {
    c.close();
  }
});
test("closing rejects in-flight requests", async () => {
  const c = client();
  const result = assert.rejects(c.request({ op: "hang" }), /closed/);
  c.close();
  await result;
});
test("invalid protocol output is reported", async () => {
  const c = client();
  try {
    await assert.rejects(c.request({ op: "bad" }), /JSON|protocol/);
  } finally {
    c.close();
  }
});
test("missing executable reports a launch error", async () => {
  const c = new ServiceClient("/nonexistent/digup", []);
  try {
    await assert.rejects(c.request({ op: "status" }), /ENOENT/);
  } finally {
    c.close();
  }
});
