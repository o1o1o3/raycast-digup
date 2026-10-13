import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

type Reply = Record<string, unknown>;
type Pending = {
  resolve: (reply: Reply) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

/** Owns one DigUp JSON-lines process for the lifetime of a Raycast command. */
export class ServiceClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, Pending>();
  private readonly timeoutMs: number;
  private nextId = 0;
  private failure?: Error;
  private stderr = "";

  constructor(
    binary: string,
    args: string[],
    options: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.child = spawn(binary, args, {
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
      // A private process group lets shutdown include DigUp's encoder child.
      detached: process.platform !== "win32",
    });
    this.child.on("error", (error) => this.stop(error));
    this.child.stdin.on("error", (error) => this.stop(error));
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk: string) => {
      this.stderr = (this.stderr + chunk).slice(-2000);
    });
    this.child.on("exit", (code, signal) =>
      this.stop(
        new Error(`DigUp exited (${signal ?? code}). ${this.stderr.trim()}`),
      ),
    );
    const lines = createInterface({ input: this.child.stdout });
    lines.on("line", (line) => {
      if (!line.trim()) return;
      let reply: Reply;
      try {
        const parsed: unknown = JSON.parse(line);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error("Expected an object");
        reply = parsed as Reply;
      } catch {
        this.stop(new Error("Invalid JSON from the DigUp search protocol"));
        return;
      }
      if (typeof reply.id !== "number") return; // Startup/model events have no request ID.
      const pending = this.pending.get(reply.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(reply.id);
      if (reply.ok === false || typeof reply.error === "string")
        pending.reject(
          new Error(String(reply.error ?? "DigUp request failed")),
        );
      else pending.resolve(reply);
    });
  }

  request(payload: Reply): Promise<Reply> {
    if (this.failure) return Promise.reject(this.failure);
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          this.stop(
            new Error(
              "DigUp search timed out. Retry to restart the search service.",
            ),
          ),
        this.timeoutMs,
      );
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ ...payload, id }) + "\n");
    });
  }

  close() {
    this.stop(new Error("DigUp search service closed"));
  }

  private stop(error: Error) {
    if (this.failure) return;
    this.failure = error;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
    this.child.stdin.end();
    if (this.child.exitCode !== null || this.child.signalCode !== null) {
      this.terminateGroup();
      return;
    }
    // Upstream allows its encoder 3 s to exit. Bound a stuck search after that
    // grace period, including descendants instead of only killing the helper.
    const kill = setTimeout(() => this.terminateGroup(), 3500);
    kill.unref();
    this.child.once("exit", () => {
      clearTimeout(kill);
      this.terminateGroup();
    });
  }

  private terminateGroup() {
    if (!this.child.pid) return;
    try {
      if (process.platform === "win32") this.child.kill("SIGTERM");
      else process.kill(-this.child.pid, "SIGTERM");
    } catch {
      /* ESRCH: the group already finished its normal shutdown. */
    }
  }
}
