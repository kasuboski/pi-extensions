import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type AgentResult, updateAgentResult } from "./index.ts";
import lifecycleExtension, { hasAgentSettled } from "./lifecycle.ts";

const originalSettledFile = process.env.PI_AGENT_SETTLED_FILE;
const originalSettledSessionId = process.env.PI_AGENT_SETTLED_SESSION_ID;
const tempDirs: string[] = [];

afterEach(async () => {
  if (originalSettledFile === undefined) delete process.env.PI_AGENT_SETTLED_FILE;
  else process.env.PI_AGENT_SETTLED_FILE = originalSettledFile;

  if (originalSettledSessionId === undefined) delete process.env.PI_AGENT_SETTLED_SESSION_ID;
  else process.env.PI_AGENT_SETTLED_SESSION_ID = originalSettledSessionId;

  await Promise.all(tempDirs.splice(0).map((dir) =>
    fs.promises.rm(dir, { recursive: true, force: true }),
  ));
});

it("clears a transient model error after a successful retry", () => {
  const result: AgentResult = {
    exitCode: 0,
    messages: [],
    stderr: "",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
      contextTokens: 0,
      turns: 0,
    },
  };

  updateAgentResult(result, {
    role: "assistant",
    content: [],
    stopReason: "error",
    errorMessage: "503 service unavailable",
  } as any);
  updateAgentResult(result, {
    role: "assistant",
    content: [{ type: "text", text: "retried successfully" }],
    stopReason: "stop",
  } as any);

  assert.equal(result.stopReason, "stop");
  assert.equal(result.errorMessage, undefined);
  assert.equal(result.messages.length, 2);
});

it("signals the herdr parent only when its direct child fully settles", async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-agent-test-"));
  tempDirs.push(tempDir);
  const settledFile = path.join(tempDir, "agent-settled");
  process.env.PI_AGENT_SETTLED_FILE = settledFile;
  process.env.PI_AGENT_SETTLED_SESSION_ID = "direct-child";

  const handlers = new Map<string, (...args: any[]) => Promise<void>>();
  const pi = {
    on(event: string, handler: (...args: any[]) => Promise<void>) {
      handlers.set(event, handler);
    },
    registerTool() {},
  } as unknown as ExtensionAPI;

  lifecycleExtension(pi);

  assert.equal(await hasAgentSettled(settledFile), false);
  const onSettled = handlers.get("agent_settled");
  assert.ok(onSettled);

  await onSettled?.({}, { sessionManager: { getSessionId: () => "nested-child" } });
  assert.equal(await hasAgentSettled(settledFile), false);

  await onSettled?.({}, { sessionManager: { getSessionId: () => "direct-child" } });
  assert.equal(await hasAgentSettled(settledFile), true);
  assert.equal(await fs.promises.readFile(settledFile, "utf8"), "settled\n");
});
