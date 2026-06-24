import fs from "node:fs/promises";
import path from "node:path";

export async function normalizeAttachmentRoots(roots: readonly string[] = []): Promise<string[]> {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    const trimmed = root.trim();
    if (!trimmed) {
      continue;
    }
    const resolved = path.resolve(trimmed);
    const real = await fs.realpath(resolved);
    const stats = await fs.stat(real);
    if (!stats.isDirectory()) {
      throw new Error(`Remote attachment root is not a directory: ${resolved}`);
    }
    if (!seen.has(real)) {
      seen.add(real);
      normalized.push(real);
    }
  }
  return normalized;
}

export function isPathInsideRoot(filePath: string, root: string): boolean {
  const relative = path.relative(root, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function resolvePathInAttachmentRoots(
  filePath: string,
  roots: readonly string[],
): Promise<string | null> {
  if (roots.length === 0) {
    return null;
  }
  const realFilePath = await fs.realpath(path.resolve(filePath));
  return roots.some((root) => isPathInsideRoot(realFilePath, root)) ? realFilePath : null;
}
