import { spawn } from "node:child_process";

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: process.platform === "win32",
      stdio: options.log ? ["inherit", "pipe", "pipe"] : "inherit",
    });

    if (options.log) {
      for (const [stream, output] of [
        [child.stdout, process.stdout],
        [child.stderr, process.stderr],
      ]) {
        stream.on("data", (chunk) => {
          output.write(chunk);
          options.log.write(chunk);
        });
      }
    }

    child.on("error", reject);
    // Reports consume the log immediately after this promise resolves. Wait
    // until stdout/stderr are drained, not just until the process exits.
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `${command} ${args.join(" ")} exited with signal ${signal}`
            : `${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`,
        ),
      );
    });
  });
}
