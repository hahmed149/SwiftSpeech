import { existsSync, lstatSync, readlinkSync, copyFileSync, chmodSync, unlinkSync, mkdirSync, readdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { execSync } from "child_process";

const ROOT = join(__dirname, "..");
const WHISPER_PATH = join(ROOT, "resources", "whisper", "whisper-cli");
const LIB_DIR = join(ROOT, "resources", "lib");
const MODEL_PATH = join(ROOT, "resources", "models", "ggml-base.en.bin");

const REQUIRED_DYLIBS = [
  "libwhisper.1.dylib",
  "libggml.0.dylib",
  "libggml-base.0.dylib",
  "libggml-cpu.0.dylib",
  "libggml-blas.0.dylib",
  "libggml-metal.0.dylib",
];

function check(label: string, path: string): boolean {
  if (!existsSync(path)) {
    console.error(`MISSING: ${label} — ${path}`);
    return false;
  }
  console.log(`  OK: ${label}`);
  return true;
}

function resolveSymlink(path: string): string {
  if (lstatSync(path).isSymbolicLink()) {
    return resolveSymlink(resolve(dirname(path), readlinkSync(path)));
  }
  return path;
}

function findWhisperLibDir(): string | null {
  // Try Homebrew cellar first
  try {
    const cellarPath = execSync("brew --cellar whisper-cpp 2>/dev/null", { encoding: "utf-8" }).trim();
    const versions = readdirSync(cellarPath).sort().reverse();
    for (const ver of versions) {
      const libExec = join(cellarPath, ver, "libexec", "lib");
      if (existsSync(libExec)) return libExec;
      const lib = join(cellarPath, ver, "lib");
      if (existsSync(lib)) return lib;
    }
  } catch {}

  // Fallback to /opt/homebrew/lib
  if (existsSync("/opt/homebrew/lib/libwhisper.1.dylib")) return "/opt/homebrew/lib";

  return null;
}

console.log("Preparing resources for distribution...\n");

// Resolve whisper symlink to actual binary
if (existsSync(WHISPER_PATH) && lstatSync(WHISPER_PATH).isSymbolicLink()) {
  const target = resolveSymlink(WHISPER_PATH);
  console.log(`  Resolving symlink: ${WHISPER_PATH}`);
  console.log(`    → copying from: ${target}`);

  unlinkSync(WHISPER_PATH);
  copyFileSync(target, WHISPER_PATH);
  chmodSync(WHISPER_PATH, 0o755);
  console.log(`  OK: whisper binary copied (no longer a symlink)\n`);
} else {
  console.log("  whisper-cli is already a real binary\n");
}

// Copy required dylibs to resources/lib/
const sourceLibDir = findWhisperLibDir();
if (sourceLibDir) {
  mkdirSync(LIB_DIR, { recursive: true });
  console.log(`  Copying dylibs from: ${sourceLibDir}`);

  for (const dylib of REQUIRED_DYLIBS) {
    const src = join(sourceLibDir, dylib);
    const dest = join(LIB_DIR, dylib);
    if (existsSync(src)) {
      const realSrc = resolveSymlink(src);
      copyFileSync(realSrc, dest);
      chmodSync(dest, 0o755);
      console.log(`  OK: ${dylib}`);
    } else {
      console.warn(`  WARN: ${dylib} not found at ${src}`);
    }
  }
  console.log();
} else {
  console.error("  ERROR: Cannot find whisper-cpp dylibs. Install via: brew install whisper-cpp");
}

// Verify resources
let ok = true;
ok = check("whisper binary", WHISPER_PATH) && ok;
ok = check("whisper model", MODEL_PATH) && ok;
for (const dylib of REQUIRED_DYLIBS) {
  ok = check(dylib, join(LIB_DIR, dylib)) && ok;
}

if (!ok) {
  console.error("\nRun `npm run setup` first to download missing resources.");
  process.exit(1);
}

console.log("\nReady to package. Run: npm run dist");
