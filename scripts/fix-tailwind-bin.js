/**
 * Hugo css.TailwindCSS must execute tailwindcss as a Node .mjs entry - not pnpm's shell shim.
 * See: https://github.com/gohugoio/hugo/issues/14852
 *
 * Writes a tiny Node shim to node_modules/.bin/tailwindcss (no symlinks).
 * On Windows also overwrites tailwindcss.cmd / tailwindcss.ps1 so pnpm wrappers
 * do not win when Hugo or the shell resolves the binary.
 */
const fs = require("fs");
const path = require("path");
const { platform } = require("node:os");

const SHIM_MARKER = "fix-tailwind-bin-shim";
const binDir = path.join(__dirname, "../node_modules/.bin");
const binPath = path.join(binDir, "tailwindcss");
const shimMjsPath = path.join(binDir, "tailwindcss-shim.mjs");
const winCmdPath = path.join(binDir, "tailwindcss.cmd");
const winPs1Path = path.join(binDir, "tailwindcss.ps1");

/** @returns {"windows"|"macos"|"linux"|"unknown"} */
function detectPlatform(osName = platform()) {
  switch (osName) {
    case "win32":
      return "windows";
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    default:
      return "unknown";
  }
}

const os = detectPlatform();
const isWindows = os === "windows";
const isMac = os === "macos";
const isLinux = os === "linux";
const isUnix = isMac || isLinux || os === "unknown";

const shimMjsSource = `// ${SHIM_MARKER}
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../package.json"),
);
const cliEntry = join(
  dirname(require.resolve("@tailwindcss/cli/package.json")),
  "dist/index.mjs",
);
await import(pathToFileURL(cliEntry).href);
`;

const unixLauncherSource = `#!/usr/bin/env node
// ${SHIM_MARKER}
import "./tailwindcss-shim.mjs";
`;

// Hugo on Windows resolves tailwindcss.cmd first and parses npm-style wrappers with
// a relative path containing ".." or "node_modules" (see gohugoio/hugo common/hexec/exec.go).
// The path must be "%~dp0\..\@tailwindcss\..." — a slash before ".." — or Hugo's
// nodeEntryPointRe never matches and css.TailwindCSS fails with "not a Node.js script".
const winCmdSource = [
  "@ECHO off",
  `REM ${SHIM_MARKER}`,
  'node "%~dp0\\..\\@tailwindcss\\cli\\dist\\index.mjs" %*',
].join("\r\n") + "\r\n";

// Mirrors gohugoio/hugo common/hexec/exec.go nodeEntryPointRe.
const hugoNodeEntryPointRe =
  /[/\\]((?:\.\.|node_modules)[/\\][\w@][\w@./\\-]*)/;

function hugoExtractsCliEntry(cmdSource) {
  const m = hugoNodeEntryPointRe.exec(cmdSource);
  if (!m) return "";
  return m[1].replace(/\\/g, "/");
}

const winPs1Source = `#!/usr/bin/env pwsh
# ${SHIM_MARKER}
$basedir = Split-Path $MyInvocation.MyCommand.Definition -Parent
& node (Join-Path $basedir "tailwindcss-shim.mjs") @args
exit $LASTEXITCODE
`;

function readText(filePath) {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function isValidWinCmd(cmd) {
  return (
    cmd.includes(SHIM_MARKER) &&
    (cmd.includes("@tailwindcss/cli/dist/index.mjs") ||
      cmd.includes("@tailwindcss\\cli\\dist\\index.mjs"))
  );
}

function isFixed() {
  if (!readText(shimMjsPath).includes(SHIM_MARKER)) return false;
  if (!isWindows && !readText(binPath).includes(SHIM_MARKER)) return false;
  if (!isWindows && fs.existsSync(binPath) && fs.lstatSync(binPath).isSymbolicLink()) {
    return false;
  }

  if (isWindows) {
    if (fs.existsSync(binPath)) return false;
    if (!isValidWinCmd(readText(winCmdPath))) return false;
    if (!readText(winPs1Path).includes(SHIM_MARKER)) return false;
    return true;
  }

  if (isUnix) {
    // macOS/Linux: shebang launcher only; no .cmd/.ps1 required.
    if (!readText(binPath).startsWith("#!/usr/bin/env node")) return false;
    return true;
  }

  return false;
}

function removeBinFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    fs.chmodSync(filePath, 0o666);
  } catch {
    // ponytail: Windows pnpm .cmd stubs can be read-only; chmod before rm.
  }
  fs.rmSync(filePath, { force: true, maxRetries: 5, retryDelay: 50 });
}

function writeExecutable(filePath, content) {
  // Unlink first: pnpm on macOS/Linux often symlinks .bin entries; writing
  // through a symlink would corrupt the real @tailwindcss/cli package.
  removeBinFile(filePath);
  fs.writeFileSync(filePath, content, { encoding: "utf8" });
  if (!isWindows) {
    try {
      fs.chmodSync(filePath, 0o755);
    } catch {
      // ignore
    }
  }
}

function applyFix() {
  if (!fs.existsSync(path.join(__dirname, "../node_modules/@tailwindcss/cli"))) {
    console.warn("fix-tailwind-bin: @tailwindcss/cli not found; skipping.");
    return;
  }

  if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

  writeExecutable(shimMjsPath, shimMjsSource);

  if (isWindows) {
    // Drop the extensionless stub — Hugo's LookPath prefers .cmd; a shebang file
    // left in .bin is useless on Windows and can confuse tooling.
    removeBinFile(binPath);
    writeExecutable(winCmdPath, winCmdSource);
    writeExecutable(winPs1Path, winPs1Source);
    if (!isValidWinCmd(readText(winCmdPath))) {
      throw new Error(`failed to patch ${path.basename(winCmdPath)}`);
    }
    return;
  }

  if (isMac || isLinux) {
    writeExecutable(binPath, unixLauncherSource);
    return;
  }

  console.warn(
    `fix-tailwind-bin: unsupported platform ${platform()}; using macOS/Linux layout.`,
  );
  writeExecutable(binPath, unixLauncherSource);
}

function selfCheck() {
  const failures = [];
  const posixBinDir = "/Users/dev/proj/node_modules/.bin";
  const posixPkg = path.posix.normalize(
    path.posix.join(posixBinDir, "..", "..", "package.json"),
  );
  if (posixPkg !== "/Users/dev/proj/package.json") {
    failures.push(`posix package.json path: got ${posixPkg}`);
  }

  const winBinDir = "C:\\proj\\node_modules\\.bin";
  const winPkg = path.win32.normalize(
    path.win32.join(winBinDir, "..", "..", "package.json"),
  );
  if (winPkg !== "C:\\proj\\package.json") {
    failures.push(`win32 package.json path: got ${winPkg}`);
  }

  for (const [name, source] of [
    ["shimMjsSource", shimMjsSource],
    ["unixLauncherSource", unixLauncherSource],
    ["winCmdSource", winCmdSource],
    ["winPs1Source", winPs1Source],
  ]) {
    if (!source.includes(SHIM_MARKER)) failures.push(`${name} missing marker`);
  }

  if (!shimMjsSource.includes("pathToFileURL(cliEntry)")) {
    failures.push("shim must import CLI via file URL");
  }
  if (!winCmdSource.includes("\r\n")) {
    failures.push("winCmdSource must use CRLF line endings");
  }
  const hugoEntry = hugoExtractsCliEntry(winCmdSource);
  if (!hugoEntry.includes("@tailwindcss/cli/dist/index.mjs")) {
    failures.push(
      `winCmdSource must match Hugo nodeEntryPointRe; got ${hugoEntry || "no match"}`,
    );
  }

  for (const [input, expected] of [
    ["win32", "windows"],
    ["darwin", "macos"],
    ["linux", "linux"],
    ["freebsd", "unknown"],
  ]) {
    if (detectPlatform(input) !== expected) {
      failures.push(`detectPlatform(${input}): expected ${expected}`);
    }
  }
  if (!["windows", "macos", "linux", "unknown"].includes(os)) {
    failures.push(`unsupported host platform: ${platform()}`);
  }

  if (failures.length) {
    console.error("fix-tailwind-bin self-check failed:");
    for (const msg of failures) console.error(`  - ${msg}`);
    process.exit(1);
  }
  console.log("fix-tailwind-bin self-check OK");
}

if (process.argv.includes("--self-check")) {
  selfCheck();
} else {
  try {
    if (!isFixed()) applyFix();
  } catch (err) {
    console.error("fix-tailwind-bin:", err.message);
    process.exit(1);
  }
}
