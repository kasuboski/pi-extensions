import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TerminalManager, MAX_OUTPUT } from "./manager.ts";

const nodeCommand = (source: string) => `${JSON.stringify(process.execPath)} -e ${JSON.stringify(source)}`;

describe("TerminalManager", () => {
  it("captures output and exit status", async () => {
    const manager = new TerminalManager();
    const terminal = manager.start("printf hello; printf problem >&2", process.cwd());
    try {
      await manager.wait(terminal.id);
      assert.equal(manager.get(terminal.id)?.stdout, "hello");
      assert.equal(manager.get(terminal.id)?.stderr, "problem");
      assert.equal(manager.get(terminal.id)?.status, "exited");
    } finally {
      await manager.dispose();
    }
  });

  it("bounds combined captured output and flags truncation", async () => {
    const manager = new TerminalManager();
    const terminal = manager.start(nodeCommand(`process.stdout.write('x'.repeat(${MAX_OUTPUT + 100}))`), process.cwd());
    try {
      await manager.wait(terminal.id);
      const result = manager.get(terminal.id)!;
      assert.equal(result.stdout.length, MAX_OUTPUT);
      assert.equal(result.truncated, true);
    } finally {
      await manager.dispose();
    }
  });

  it("kills a running process tree and resolves only after completion", async () => {
    const manager = new TerminalManager();
    const terminal = manager.start("sleep 30", process.cwd());
    try {
      assert.equal(await manager.kill(terminal.id), true);
      assert.equal((await manager.wait(terminal.id)).status, "killed");
      assert.equal(manager.get(terminal.id)?.status, "killed");
    } finally {
      await manager.dispose();
    }
  });

  it("keeps complete private logs while bounding captured output", async () => {
    const manager = new TerminalManager();
    const terminal = manager.start(nodeCommand(`process.stdout.write('x'.repeat(${MAX_OUTPUT + 100}))`), process.cwd());
    try {
      const completed = await manager.wait(terminal.id);
      assert.equal(completed.stdout.length, MAX_OUTPUT);
      assert.equal(completed.truncated, true);
      const logs = await manager.readLogs(terminal.id, "stdout") as string;
      assert.equal(logs.length, MAX_OUTPUT + 100);
    } finally {
      await manager.dispose();
    }
  });

  it("publishes output and completion status events", async () => {
    const manager = new TerminalManager();
    const events: string[] = [];
    const unsubscribe = manager.subscribe((event) => events.push(event.type));
    const terminal = manager.start("printf hello", process.cwd());
    try {
      assert.equal((await manager.wait(terminal.id)).stdout, "hello");
      assert.ok(events.includes("started"));
      assert.ok(events.includes("output"));
      assert.ok(events.includes("status"));
      assert.ok(events.includes("completed"));
    } finally {
      unsubscribe();
      await manager.dispose();
    }
  });

  it("handles kill racing with natural process exit", async () => {
    const manager = new TerminalManager();
    const terminal = manager.start("true", process.cwd());
    try {
      await manager.wait(terminal.id);
      assert.equal(await manager.kill(terminal.id), false);
      assert.equal(manager.get(terminal.id)?.status, "exited");
    } finally {
      await manager.dispose();
    }
  });
});
