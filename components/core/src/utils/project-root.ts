import * as path from 'path';
import * as fs from 'fs';

/**
 * Find the project root directory by walking up the directory tree
 * looking for package.json with workspaces field
 */
export function findProjectRoot(startDir: string = __dirname): string {
  let currentDir = startDir;

  while (currentDir !== path.dirname(currentDir)) {
    const pkgPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.workspaces) {
          return currentDir;
        }
      } catch {
        // Continue searching
      }
    }
    currentDir = path.dirname(currentDir);
  }

  // If we can't find project root, assume current working directory
  return process.cwd();
}

/**
 * Resolve a path relative to the project root
 */
export function resolveFromProjectRoot(...paths: string[]): string {
  const projectRoot = findProjectRoot();
  return path.resolve(projectRoot, ...paths);
}
