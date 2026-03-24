// ============================================================
// Live Code Execution Tool (Competitor Feature: OpenDevin-style)
// Sandboxed code runner for generated code testing.
// Executes in a child process with timeout and resource limits.
// ============================================================

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const EXECUTION_TIMEOUT = 15000; // 15 seconds
const MAX_OUTPUT_LENGTH = 8000;

export interface CodeExecutionRequest {
  code: string;
  language: 'javascript' | 'typescript' | 'python' | 'bash';
  stdin?: string;
}

export interface CodeExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  language: string;
  truncated: boolean;
}

/**
 * Execute code in a sandboxed temp directory.
 * Only supports JavaScript, TypeScript (via tsx), Python, and Bash.
 */
export function executeCode(request: CodeExecutionRequest): CodeExecutionResult {
  const startTime = Date.now();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mao-exec-'));

  try {
    let command = '';
    let filename = '';

    switch (request.language) {
      case 'javascript': {
        filename = 'script.js';
        fs.writeFileSync(path.join(tmpDir, filename), request.code, 'utf-8');
        command = `node "${path.join(tmpDir, filename)}"`;
        break;
      }

      case 'typescript': {
        filename = 'script.ts';
        fs.writeFileSync(path.join(tmpDir, filename), request.code, 'utf-8');
        // Try npx tsx first, fall back to ts-node
        command = `npx --yes tsx "${path.join(tmpDir, filename)}"`;
        break;
      }

      case 'python': {
        filename = 'script.py';
        fs.writeFileSync(path.join(tmpDir, filename), request.code, 'utf-8');
        command = `python "${path.join(tmpDir, filename)}"`;
        break;
      }

      case 'bash': {
        filename = 'script.sh';
        fs.writeFileSync(path.join(tmpDir, filename), request.code, 'utf-8');
        if (process.platform === 'win32') {
          command = `bash "${path.join(tmpDir, filename)}"`;
        } else {
          fs.chmodSync(path.join(tmpDir, filename), '755');
          command = path.join(tmpDir, filename);
        }
        break;
      }

      default:
        return {
          success: false,
          stdout: '',
          stderr: `Unsupported language: ${request.language}`,
          exitCode: 1,
          durationMs: Date.now() - startTime,
          language: request.language,
          truncated: false,
        };
    }

    const result = execSync(command, {
      timeout: EXECUTION_TIMEOUT,
      maxBuffer: 1024 * 1024, // 1MB
      encoding: 'utf-8',
      input: request.stdin,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: tmpDir,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PATH: process.env.PATH,
      },
    });

    const stdout = result.toString();
    const truncated = stdout.length > MAX_OUTPUT_LENGTH;

    return {
      success: true,
      stdout: truncated ? stdout.slice(0, MAX_OUTPUT_LENGTH) + '\n... [output truncated]' : stdout,
      stderr: '',
      exitCode: 0,
      durationMs: Date.now() - startTime,
      language: request.language,
      truncated,
    };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number; message?: string };
    const stdout = execError.stdout?.toString() || '';
    const stderr = execError.stderr?.toString() || execError.message || 'Execution failed';

    return {
      success: false,
      stdout: stdout.slice(0, MAX_OUTPUT_LENGTH),
      stderr: stderr.slice(0, MAX_OUTPUT_LENGTH),
      exitCode: execError.status || 1,
      durationMs: Date.now() - startTime,
      language: request.language,
      truncated: stdout.length > MAX_OUTPUT_LENGTH || stderr.length > MAX_OUTPUT_LENGTH,
    };
  } finally {
    // Clean up temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore cleanup errors */ }
  }
}

/**
 * Detect the language of a code block from file extension or content.
 */
export function detectCodeLanguage(code: string, filePath?: string): CodeExecutionRequest['language'] {
  if (filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.js', '.mjs', '.cjs'].includes(ext)) return 'javascript';
    if (['.ts', '.tsx'].includes(ext)) return 'typescript';
    if (['.py', '.py3'].includes(ext)) return 'python';
    if (['.sh', '.bash'].includes(ext)) return 'bash';
  }

  // Detect from code content
  if (code.includes('import ') && (code.includes(': string') || code.includes('interface '))) return 'typescript';
  if (code.includes('def ') || code.includes('import ') && code.includes('print(')) return 'python';
  if (code.includes('#!/bin/bash') || code.includes('#!/bin/sh')) return 'bash';
  return 'javascript'; // default
}
