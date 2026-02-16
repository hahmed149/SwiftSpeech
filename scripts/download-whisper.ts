import { execSync } from "child_process";
import { existsSync, mkdirSync, copyFileSync, chmodSync, lstatSync, readlinkSync, readdirSync } from "fs";
import { join, resolve, dirname } from "path";

const RESOURCES_DIR = join(__dirname, "..", "resources", "whisper");
const LIB_DIR = join(__dirname, "..", "resources", "lib");
const BINARY_PATH = join(RESOURCES_DIR, "whisper-cli");

const REQUIRED_DYLIBS = [
  "libwhisper.1.dylib",
  "libggml.0.dylib",
  "libggml-base.0.dylib",
  "libggml-cpu.0.dylib",
  "libggml-blas.0.dylib",
  "libggml-metal.0.dylib",
];

function resolveSymlink(path: string): string {
  if (lstatSync(path).isSymbolicLink()) {
    return resolveSymlink(resolve(dirname(path), readlinkSync(path)));
  }
  return path;
}

function findWhisperLibDir(): string | null {
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
  if (existsSync("/opt/homebrew/lib/libwhisper.1.dylib")) return "/opt/homebrew/lib";
  return null;
}

function copyDylibs() {
  const sourceLibDir = findWhisperLibDir();
  if (!sourceLibDir) {
    console.warn("WARN: Could not find whisper-cpp dylibs. Transcription may fail at runtime.");
    return;
  }

  mkdirSync(LIB_DIR, { recursive: true });
  console.log(`Copying dylibs from: ${sourceLibDir}`);

  for (const dylib of REQUIRED_DYLIBS) {
    const src = join(sourceLibDir, dylib);
    if (existsSync(src)) {
      const realSrc = resolveSymlink(src);
      copyFileSync(realSrc, join(LIB_DIR, dylib));
      chmodSync(join(LIB_DIR, dylib), 0o755);
      console.log(`  OK: ${dylib}`);
    } else {
      console.warn(`  WARN: ${dylib} not found`);
    }
  }
}

// Use Homebrew-installed whisper.cpp if available, otherwise download
async function main() {
  mkdirSync(RESOURCES_DIR, { recursive: true });

  if (!existsSync(BINARY_PATH)) {
    // Check if whisper.cpp is installed via Homebrew
    let found = false;
    try {
      const brewPath = execSync("which whisper-cli 2>/dev/null || which whisper-cpp 2>/dev/null", {
        encoding: "utf-8",
      }).trim();
      if (brewPath) {
        console.log(`Found whisper at ${brewPath}, creating symlink...`);
        execSync(`ln -sf "${brewPath}" "${BINARY_PATH}"`);
        found = true;
      }
    } catch {}

    if (!found) {
      // Build from source using Homebrew
      console.log("Installing whisper-cpp via Homebrew...");
      try {
        execSync("brew install whisper-cpp", { stdio: "inherit" });
        const brewPath = execSync("which whisper-cli 2>/dev/null || which whisper-cpp 2>/dev/null", {
          encoding: "utf-8",
        }).trim();
        if (brewPath) {
          execSync(`ln -sf "${brewPath}" "${BINARY_PATH}"`);
          found = true;
        }
      } catch {
        console.error(
          "Could not install whisper-cpp.\n" +
          "Please install manually:\n" +
          "  brew install whisper-cpp\n" +
          "Then run: npm run download:whisper"
        );
        process.exit(1);
      }
    }
  } else {
    console.log("whisper-cli already exists at", BINARY_PATH);
  }

  // Always ensure dylibs are present
  copyDylibs();
  console.log("Done.");
}

main();
