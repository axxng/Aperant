import { tool } from 'ai';
import { z } from 'zod';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { globSync } from 'glob';

export interface ToolContext {
  /** Root directory for file operations */
  cwd: string;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

/**
 * Validate that a path is within the allowed directory (prevent path traversal).
 */
function validatePath(filePath: string, cwd: string): string {
  const resolved = resolve(cwd, filePath);
  const rel = relative(cwd, resolved);
  if (rel.startsWith('..') || resolve(resolved) !== resolved && !resolved.startsWith(cwd)) {
    throw new Error(`Path "${filePath}" is outside the allowed directory`);
  }
  return resolved;
}

/**
 * Create all builtin tools bound to a working directory context.
 */
export function createBuiltinTools(context: ToolContext) {
  const readTool = tool({
    description: 'Read a file from the filesystem. Returns file content with line numbers. Use offset and limit for large files.',
    parameters: z.object({
      file_path: z.string().describe('Absolute or relative path to the file'),
      offset: z.number().optional().describe('Line number to start reading from (1-based)'),
      limit: z.number().optional().describe('Maximum number of lines to read (default 2000)'),
    }),
    execute: async ({ file_path, offset, limit }) => {
      const resolved = validatePath(file_path, context.cwd);
      const stat = statSync(resolved);
      if (stat.isDirectory()) {
        return `Error: "${file_path}" is a directory, not a file. Use Glob to list directory contents.`;
      }
      const content = readFileSync(resolved, 'utf-8');
      const lines = content.split('\n');
      const startLine = Math.max(1, offset ?? 1);
      const maxLines = limit ?? 2000;
      const sliced = lines.slice(startLine - 1, startLine - 1 + maxLines);
      const numbered = sliced.map((line, i) => `${String(startLine + i).padStart(6)}│${line}`).join('\n');
      const totalLines = lines.length;
      let result = numbered;
      if (startLine + maxLines - 1 < totalLines) {
        result += `\n... (${totalLines - startLine - maxLines + 1} more lines)`;
      }
      return result;
    },
  });

  const globTool = tool({
    description: 'Find files matching a glob pattern. Returns matching file paths sorted by modification time.',
    parameters: z.object({
      pattern: z.string().describe('Glob pattern (e.g., "**/*.ts", "src/**/*.tsx")'),
      path: z.string().optional().describe('Directory to search in (defaults to cwd)'),
    }),
    execute: async ({ pattern, path: searchPath }) => {
      const baseDir = searchPath ? validatePath(searchPath, context.cwd) : context.cwd;
      const matches = globSync(pattern, {
        cwd: baseDir,
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
      });
      if (matches.length === 0) {
        return 'No files matched the pattern.';
      }
      // Sort by modification time (newest first), limit to 200
      const withStats = matches.map(f => {
        const fullPath = join(baseDir, f);
        try {
          const s = statSync(fullPath);
          return { path: f, mtime: s.mtimeMs };
        } catch {
          return { path: f, mtime: 0 };
        }
      });
      withStats.sort((a, b) => b.mtime - a.mtime);
      const limited = withStats.slice(0, 200);
      return limited.map(f => f.path).join('\n') + (matches.length > 200 ? `\n... and ${matches.length - 200} more` : '');
    },
  });

  const grepTool = tool({
    description: 'Search file contents using a regex pattern. Returns matching file paths or content with context.',
    parameters: z.object({
      pattern: z.string().describe('Regex pattern to search for'),
      path: z.string().optional().describe('File or directory to search in'),
      glob: z.string().optional().describe('Glob pattern to filter files (e.g., "*.ts")'),
      output_mode: z.enum(['content', 'files_with_matches', 'count']).optional().describe('Output mode (default: files_with_matches)'),
      context: z.number().optional().describe('Lines of context around matches'),
    }),
    execute: async ({ pattern, path: searchPath, glob: fileGlob, output_mode, context: ctxLines }) => {
      const baseDir = searchPath ? validatePath(searchPath, context.cwd) : context.cwd;
      const mode = output_mode ?? 'files_with_matches';

      // Find files to search
      const globPattern = fileGlob ?? '**/*';
      const files = globSync(globPattern, {
        cwd: baseDir,
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
      });

      const regex = new RegExp(pattern, 'gi');
      const results: string[] = [];
      const maxResults = 100;

      for (const file of files) {
        if (results.length >= maxResults) break;
        const fullPath = join(baseDir, file);
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          const matchingLines: number[] = [];

          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              matchingLines.push(i);
            }
            regex.lastIndex = 0; // Reset regex state
          }

          if (matchingLines.length > 0) {
            if (mode === 'files_with_matches') {
              results.push(file);
            } else if (mode === 'count') {
              results.push(`${file}: ${matchingLines.length}`);
            } else {
              const contextLines = ctxLines ?? 0;
              for (const lineNum of matchingLines.slice(0, 10)) {
                const start = Math.max(0, lineNum - contextLines);
                const end = Math.min(lines.length - 1, lineNum + contextLines);
                const snippet = lines.slice(start, end + 1)
                  .map((l, i) => `${String(start + i + 1).padStart(4)}│${l}`)
                  .join('\n');
                results.push(`${file}:\n${snippet}`);
              }
            }
          }
        } catch {
          // Skip unreadable files
        }
      }

      return results.length > 0 ? results.join('\n') : 'No matches found.';
    },
  });

  const webFetchTool = tool({
    description: 'Fetch content from a URL and return it as text.',
    parameters: z.object({
      url: z.string().url().describe('URL to fetch'),
      prompt: z.string().optional().describe('What to extract from the page'),
    }),
    execute: async ({ url }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Aperant-Web/1.0' },
        });
        if (!response.ok) {
          return `HTTP ${response.status}: ${response.statusText}`;
        }
        const text = await response.text();
        // Truncate to ~50k chars to avoid token limits
        return text.length > 50000 ? text.slice(0, 50000) + '\n... (truncated)' : text;
      } catch (err: any) {
        return `Fetch error: ${err.message}`;
      } finally {
        clearTimeout(timeout);
      }
    },
  });

  return {
    Read: readTool,
    Glob: globTool,
    Grep: grepTool,
    WebFetch: webFetchTool,
  };
}

/** Get tools filtered by allowed tool names */
export function getToolsForAgent(
  allTools: ReturnType<typeof createBuiltinTools>,
  allowedTools: readonly string[],
): Record<string, ReturnType<typeof tool>> {
  const filtered: Record<string, ReturnType<typeof tool>> = {};
  for (const name of allowedTools) {
    const t = allTools[name as keyof typeof allTools];
    if (t) {
      filtered[name] = t;
    }
  }
  return filtered;
}
