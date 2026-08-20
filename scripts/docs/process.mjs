import { spawn } from 'node:child_process';

const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

export function spawnDirect(executable, args, options = {}) {
  if (!executable || typeof executable !== 'string') {
    throw new TypeError('A direct executable path or command is required.');
  }
  if (!Array.isArray(args) || args.some((argument) => typeof argument !== 'string')) {
    throw new TypeError('Direct command arguments must be an array of strings.');
  }
  if (options.shell) {
    throw new Error('Documentation commands must not be spawned through a shell.');
  }
  return spawn(executable, args, {
    ...options,
    shell: false,
    windowsHide: options.windowsHide ?? true,
  });
}

export function runCommand(executable, args, options = {}) {
  const {
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
    timeoutMs = 30_000,
    encoding = 'utf8',
    ...spawnOptions
  } = options;

  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1) {
    throw new RangeError('maxOutputBytes must be a positive integer.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError('timeoutMs must be a positive integer.');
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawnDirect(executable, args, {
      ...spawnOptions,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let settled = false;
    let timeout;

    const settleError = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill();
      rejectPromise(error);
    };

    const capture = (target) => (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        settleError(new Error(`Command output exceeded ${maxOutputBytes} bytes.`));
        return;
      }
      target.push(chunk);
    };

    child.stdout.on('data', capture(stdout));
    child.stderr.on('data', capture(stderr));
    child.on('error', settleError);

    timeout = setTimeout(() => {
      settleError(new Error(`Command timed out after ${timeoutMs} ms.`));
    }, timeoutMs);

    child.on('close', (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolvePromise({
        exitCode,
        signal,
        stdout: Buffer.concat(stdout).toString(encoding),
        stderr: Buffer.concat(stderr).toString(encoding),
      });
    });
  });
}
