/**
 * Cross-platform process helpers for deploy/build scripts (macOS, Linux, Windows).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(__dirname, "..");
/** Hugo site root (content, layouts, hugo.toml, public/). */
export const siteRoot = join(projectRoot, "website");
const isWin = process.platform === "win32";

/** Node binary running these scripts - reliable even when `node` is not on PATH. */
export const nodeBin = process.execPath;

/**
 * Resolve an npm/pnpm binary under node_modules/.bin (handles .cmd on Windows).
 */
export function resolveLocalBin(name) {
  const binDir = join(projectRoot, "node_modules", ".bin");
  const candidates = isWin ? [`${name}.cmd`, `${name}.ps1`, name] : [name];
  for (const file of candidates) {
    const full = join(binDir, file);
    if (existsSync(full)) return full;
  }
  return null;
}

function needsShell(cmd) {
  return isWin && /\.(cmd|bat|ps1)$/i.test(cmd);
}

/**
 * Run a command; throws nothing - exits the process on failure.
 */
export function run(cmd, args = [], opts = {}) {
  const cwd = opts.cwd ?? projectRoot;
  const shell = opts.shell ?? needsShell(cmd);

  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd,
    shell,
    env: opts.env ?? process.env,
  });

  if (result.error) {
    console.error(`[run] Failed to start ${cmd}:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function runNodeScript(scriptPath, args = []) {
  run(nodeBin, [scriptPath, ...args]);
}

function runAsync(cmd, args = [], opts = {}) {
  const cwd = opts.cwd ?? projectRoot;
  const shell = opts.shell ?? needsShell(cmd);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      cwd,
      shell,
      env: opts.env ?? process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code ?? 1}`));
    });
  });
}

/** Run independent commands concurrently; exits the process on first failure. */
export async function runParallel(jobs) {
  try {
    await Promise.all(
      jobs.map(({ cmd, args = [], opts = {} }) => runAsync(cmd, args, opts)),
    );
  } catch (err) {
    console.error("[runParallel]", err.message);
    process.exit(1);
  }
}

export function runNpx(args) {
  const npx = resolveLocalBin("npx");
  if (npx) {
    run(npx, args);
    return;
  }
  run(isWin ? "npx.cmd" : "npx", args, { shell: isWin });
}

export function capture(cmd, args = []) {
  return spawnSync(cmd, args, {
    encoding: "utf8",
    cwd: projectRoot,
    shell: needsShell(cmd),
  });
}

function pythonWorks(bin, prefix = []) {
  const r = capture(bin, [
    ...prefix,
    "-c",
    "import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)",
  ]);
  return r.status === 0;
}

/** @returns {{ bin: string, prefix: string[] }} */
export function resolvePython() {
  if (process.env.PYTHON && pythonWorks(process.env.PYTHON)) {
    return { bin: process.env.PYTHON, prefix: [] };
  }
  const tries = isWin
    ? [
        ["python", []],
        ["python3", []],
        ["py", ["-3"]],
      ]
    : [
        ["python3", []],
        ["python", []],
      ];
  for (const [bin, prefix] of tries) {
    if (pythonWorks(bin, prefix)) return { bin, prefix };
  }
  console.error("[spawn] Python 3.8+ required (OKF export during deploy).");
  console.error("  Install Python 3 or set PYTHON to your python binary.");
  process.exit(1);
}

export function runPython(scriptPath, args = [], opts = {}) {
  const { bin, prefix } = resolvePython();
  const env = {
    ...process.env,
    ...opts.env,
    // Windows cp1252 console cannot print UTF-8 arrows from Python print().
    PYTHONIOENCODING: opts.env?.PYTHONIOENCODING ?? "utf-8",
  };
  run(bin, [...prefix, scriptPath, ...args], { ...opts, env });
}
