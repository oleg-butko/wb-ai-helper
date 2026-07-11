import { closeSync, existsSync, mkdirSync, openSync, writeFileSync, writeSync } from "node:fs";
import path from "node:path";

const logDirectoryEnvName = "WB_AI_HELPER_LOG_DIR";

function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatLocalLogTimestamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function createUniqueSessionDirectory(logsRoot, timestamp) {
  mkdirSync(logsRoot, { recursive: true });

  for (let sequence = 1; ; sequence += 1) {
    const suffix = sequence === 1 ? "" : `_${pad(sequence)}`;
    const candidate = path.join(logsRoot, `${timestamp}${suffix}`);

    if (!existsSync(candidate)) {
      mkdirSync(candidate);
      return candidate;
    }
  }
}

export function createLogSession({ command, projectRoot = process.cwd() }) {
  const inheritedDirectory = process.env[logDirectoryEnvName];
  const created = !inheritedDirectory;
  const directory = inheritedDirectory
    ? path.resolve(inheritedDirectory)
    : createUniqueSessionDirectory(
        path.join(projectRoot, "logs"),
        formatLocalLogTimestamp(),
      );

  mkdirSync(directory, { recursive: true });
  process.env[logDirectoryEnvName] = directory;

  if (created) {
    writeFileSync(
      path.join(directory, "session.json"),
      `${JSON.stringify({
        command,
        startedAt: new Date().toISOString(),
        localDirectoryName: path.basename(directory),
        cwd: projectRoot,
        pid: process.pid,
      }, null, 2)}\n`,
    );
  }

  const allLogFd = openSync(path.join(directory, "all.log"), "a");
  const serviceLogFds = new Map();
  let closed = false;

  function getServiceLogFd(logFileName) {
    let fd = serviceLogFds.get(logFileName);

    if (fd === undefined) {
      fd = openSync(path.join(directory, logFileName), "a");
      serviceLogFds.set(logFileName, fd);
    }

    return fd;
  }

  function writeChunk(logFileName, chunk, terminalStream) {
    if (closed) {
      return;
    }

    terminalStream.write(chunk);
    writeSync(getServiceLogFd(logFileName), chunk);
    writeSync(allLogFd, chunk);
  }

  function attachChild(child, logFileName) {
    if (!child.stdout || !child.stderr) {
      throw new Error("Logged child processes must use piped stdout and stderr.");
    }

    child.stdout.on("data", (chunk) => writeChunk(logFileName, chunk, process.stdout));
    child.stderr.on("data", (chunk) => writeChunk(logFileName, chunk, process.stderr));
  }

  function writeLine(message, terminalStream = process.stdout) {
    const line = `${message}\n`;
    terminalStream.write(line);
    writeSync(allLogFd, line);
  }

  function writeSystem(message) {
    writeLine(`[logs] ${message}`);
  }

  function close() {
    if (closed) {
      return;
    }

    closed = true;

    for (const fd of serviceLogFds.values()) {
      closeSync(fd);
    }

    closeSync(allLogFd);
  }

  return {
    directory,
    env: {
      ...process.env,
      [logDirectoryEnvName]: directory,
    },
    attachChild,
    writeLine,
    writeSystem,
    close,
  };
}
