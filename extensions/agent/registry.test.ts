import assert from "node:assert/strict";
import { it } from "node:test";
import { BackgroundRegistry } from "./registry.ts";

it("isolates owners and enforces running/tracked limits", () => {
  const registry = new BackgroundRegistry(1, 2);
  const job = registry.create("a", "one")!;
  assert.equal(registry.create("a", "two"), undefined);
  assert.equal(registry.get("b", job.id), undefined);
  registry.settle(job.id, "completed");
  assert.ok(registry.create("a", "two"));
  assert.equal(registry.list("b").length, 0);
});

it("wait completion resolves and snapshots restore across restart", async () => {
  const registry = new BackgroundRegistry();
  const job = registry.create("owner", "do work")!;
  const waiting = job.completion;
  registry.settle(job.id, "completed");
  await waiting;
  const restarted = new BackgroundRegistry();
  restarted.restore("owner", registry.snapshot("owner"));
  assert.equal(restarted.get("owner", job.id)?.status, "completed");
});

it("prunes oldest settled jobs while retaining the running limit", () => {
  const registry = new BackgroundRegistry(8, 2);
  const first = registry.create("owner", "one")!;
  registry.settle(first.id, "completed");
  const second = registry.create("owner", "two")!;
  registry.settle(second.id, "failed");
  const third = registry.create("owner", "three")!;
  assert.equal(registry.get("owner", first.id), undefined);
  assert.deepEqual(registry.list("owner").map((job) => job.id), [second.id, third.id]);
});

it("later persisted snapshots replace stale records and restart reuses session identity", () => {
  const registry = new BackgroundRegistry();
  const job = registry.create("owner", "initial task", "/tmp/project", {
    model: "aperture/gpt-6-luna",
    tools: ["read", "bash"],
  })!;
  job.runDir = "/tmp/agent-session";
  job.childSessionId = "child-session";
  const early = registry.snapshot("owner");
  registry.settle(job.id, "completed");
  const late = registry.snapshot("owner");
  const restored = new BackgroundRegistry();
  restored.restore("owner", early);
  restored.restore("owner", late);
  assert.equal(restored.get("owner", job.id)?.status, "completed");
  const restarted = restored.restart("owner", job.id, "continue work");
  assert.equal(restarted?.runDir, "/tmp/agent-session");
  assert.equal(restarted?.childSessionId, "child-session");
  assert.equal(restarted?.cwd, "/tmp/project");
  assert.deepEqual(restarted?.options, { model: "aperture/gpt-6-luna", tools: ["read", "bash"] });
  assert.equal(restarted?.status, "running");
});

it("consume is exactly once", () => {
  const registry = new BackgroundRegistry();
  const job = registry.create("owner", "work")!;
  assert.equal(registry.consume(job.id), true);
  assert.equal(registry.consume(job.id), false);
});

it("owner shutdown cancels running work", async () => {
  const registry = new BackgroundRegistry();
  const job = registry.create("owner", "work")!;
  const shuttingDown = registry.cancelOwner("owner");
  assert.equal(job.controller.signal.aborted, true);
  await shuttingDown;
  assert.equal(job.status, "cancelled");
});
