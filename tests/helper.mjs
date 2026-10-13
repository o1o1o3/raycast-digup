import readline from "node:readline";
import { spawn } from "node:child_process";
const output = (data) => process.stdout.write(JSON.stringify(data) + "\n");
output({ event: "ready" });
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  if (request.op === "descendant") {
    const worker = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      stdio: "ignore",
    });
    output({ id: request.id, pid: worker.pid });
    return;
  }
  if (request.op === "hang") return;
  if (request.op === "exit") return process.exit(3);
  if (request.op === "error")
    return output({ id: request.id, ok: false, error: "Index unavailable" });
  if (request.op === "bad") return process.stdout.write("not json\n");
  const data = JSON.stringify({ id: request.id, value: request.q }) + "\n";
  if (request.op === "split") {
    process.stdout.write(data.slice(0, 8));
    setTimeout(() => process.stdout.write(data.slice(8)), 5);
  } else
    setTimeout(
      () => output({ id: request.id, value: request.q }),
      request.delay ?? 0,
    );
});
