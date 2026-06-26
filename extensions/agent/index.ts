/**
 * Agent Tool — Spawn a subagent with an isolated context window
 *
 * Spawns a separate `pi` process, giving it an isolated context window.
 * The subagent works autonomously, then returns a single text result.
 * Override the system prompt, model, tools, and thinking level as needed.
 *
 * Sets PI_SUBAGENT=1 in the child environment so extensions (like
 * status-tracker) can detect they're running inside a subagent.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import {
  type ExtensionAPI,
  getMarkdownTheme,
  withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";

const COLLAPSED_ITEM_COUNT = 10;

// ─── formatting helpers ───────────────────────────────────────────────────────

function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

function formatUsageStats(
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    cost: number;
    contextTokens?: number;
    turns?: number;
  },
  model?: string,
): string {
  const parts: string[] = [];
  if (usage.turns)
    parts.push(`${usage.turns} turn${usage.turns > 1 ? "s" : ""}`);
  if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
  if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
  if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
  if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
  if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
  if (usage.contextTokens && usage.contextTokens > 0) {
    parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
  }
  if (model) parts.push(model);
  return parts.join(" ");
}

function formatToolCall(
  toolName: string,
  args: Record<string, unknown>,
  themeFg: (color: any, text: string) => string,
): string {
  const shortenPath = (p: string) => {
    const home = os.homedir();
    return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
  };

  switch (toolName) {
    case "bash": {
      const command = (args.command as string) || "...";
      const preview =
        command.length > 60 ? `${command.slice(0, 60)}...` : command;
      return themeFg("muted", "$ ") + themeFg("toolOutput", preview);
    }
    case "read": {
      const rawPath = (args.file_path || args.path || "...") as string;
      const filePath = shortenPath(rawPath);
      const offset = args.offset as number | undefined;
      const limit = args.limit as number | undefined;
      let text = themeFg("accent", filePath);
      if (offset !== undefined || limit !== undefined) {
        const startLine = offset ?? 1;
        const endLine = limit !== undefined ? startLine + limit - 1 : "";
        text += themeFg(
          "warning",
          `:${startLine}${endLine ? `-${endLine}` : ""}`,
        );
      }
      return themeFg("muted", "read ") + text;
    }
    case "write": {
      const rawPath = (args.file_path || args.path || "...") as string;
      const filePath = shortenPath(rawPath);
      const content = (args.content || "") as string;
      const lines = content.split("\n").length;
      let text = themeFg("muted", "write ") + themeFg("accent", filePath);
      if (lines > 1) text += themeFg("dim", ` (${lines} lines)`);
      return text;
    }
    case "edit": {
      const rawPath = (args.file_path || args.path || "...") as string;
      return (
        themeFg("muted", "edit ") + themeFg("accent", shortenPath(rawPath))
      );
    }
    case "ls": {
      const rawPath = (args.path || ".") as string;
      return themeFg("muted", "ls ") + themeFg("accent", shortenPath(rawPath));
    }
    case "find": {
      const pattern = (args.pattern || "*") as string;
      const rawPath = (args.path || ".") as string;
      return (
        themeFg("muted", "find ") +
        themeFg("accent", pattern) +
        themeFg("dim", ` in ${shortenPath(rawPath)}`)
      );
    }
    case "grep": {
      const pattern = (args.pattern || "") as string;
      const rawPath = (args.path || ".") as string;
      return (
        themeFg("muted", "grep ") +
        themeFg("accent", `/${pattern}/`) +
        themeFg("dim", ` in ${shortenPath(rawPath)}`)
      );
    }
    default: {
      const argsStr = JSON.stringify(args);
      const preview =
        argsStr.length > 50 ? `${argsStr.slice(0, 50)}...` : argsStr;
      return themeFg("accent", toolName) + themeFg("dim", ` ${preview}`);
    }
  }
}

// ─── types ────────────────────────────────────────────────────────────────────

interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
}

interface AgentResult {
  exitCode: number;
  messages: Message[];
  stderr: string;
  usage: UsageStats;
  model?: string;
  stopReason?: string;
  errorMessage?: string;
}

interface AgentDetails {
  result: AgentResult;
}

function getFinalOutput(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      for (const part of msg.content) {
        if (part.type === "text") return part.text;
      }
    }
  }
  return "";
}

type DisplayItem =
  | { type: "text"; text: string }
  | { type: "toolCall"; name: string; args: Record<string, any> };

function getDisplayItems(messages: Message[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  for (const msg of messages) {
    if (msg.role === "assistant") {
      for (const part of msg.content) {
        if (part.type === "text") items.push({ type: "text", text: part.text });
        else if (part.type === "toolCall")
          items.push({
            type: "toolCall",
            name: part.name,
            args: part.arguments,
          });
      }
    }
  }
  return items;
}

// ─── temp file for system prompt ──────────────────────────────────────────────

async function writePromptToTempFile(
  prompt: string,
): Promise<{ dir: string; filePath: string }> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-agent-"));
  const filePath = path.join(tmpDir, "system-prompt.md");
  await withFileMutationQueue(filePath, async () => {
    await fs.promises.writeFile(filePath, prompt, {
      encoding: "utf-8",
      mode: 0o600,
    });
  });
  return { dir: tmpDir, filePath };
}

// ─── pi invocation ────────────────────────────────────────────────────────────

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  if (currentScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) {
    return { command: process.execPath, args };
  }

  return { command: "pi", args };
}

// ─── agent execution ──────────────────────────────────────────────────────────

async function runAgent(
  defaultCwd: string,
  params: {
    prompt: string;
    systemPrompt?: string;
    appendSystemPrompt?: string;
    model?: string;
    thinking?: string;
    tools?: string[];
    excludeTools?: string[];
    cwd?: string;
  },
  signal: AbortSignal | undefined,
  onUpdate: ((partial: AgentToolResult<AgentDetails>) => void) | undefined,
): Promise<AgentResult> {
  const args: string[] = ["--mode", "json", "-p", "--no-session"];

  if (params.model) args.push("--model", params.model);
  if (params.thinking) args.push("--thinking", params.thinking);
  if (params.tools && params.tools.length > 0)
    args.push("--tools", params.tools.join(","));
  if (params.excludeTools && params.excludeTools.length > 0) {
    args.push("--exclude-tools", params.excludeTools.join(","));
  }

  let tmpPromptDir: string | null = null;
  let tmpPromptPath: string | null = null;

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

  const emitUpdate = () => {
    if (onUpdate) {
      onUpdate({
        content: [
          {
            type: "text",
            text: getFinalOutput(result.messages) || "(running...)",
          },
        ],
        details: { result },
      });
    }
  };

  try {
    if (params.systemPrompt && params.systemPrompt.trim()) {
      const tmp = await writePromptToTempFile(params.systemPrompt);
      tmpPromptDir = tmp.dir;
      tmpPromptPath = tmp.filePath;
      args.push("--system-prompt", tmpPromptPath);
    }

    if (params.appendSystemPrompt && params.appendSystemPrompt.trim()) {
      args.push("--append-system-prompt", params.appendSystemPrompt);
    }

    args.push(params.prompt);

    let wasAborted = false;

    const exitCode = await new Promise<number>((resolve) => {
      const invocation = getPiInvocation(args);
      const proc = spawn(invocation.command, invocation.args, {
        cwd: params.cwd ?? defaultCwd,
        env: { ...process.env, PI_SUBAGENT: "1" },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let buffer = "";

      const processLine = (line: string) => {
        if (!line.trim()) return;
        let event: any;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }

        if (event.type === "message_end" && event.message) {
          const msg = event.message as Message;
          result.messages.push(msg);

          if (msg.role === "assistant") {
            result.usage.turns++;
            const usage = msg.usage;
            if (usage) {
              result.usage.input += usage.input || 0;
              result.usage.output += usage.output || 0;
              result.usage.cacheRead += usage.cacheRead || 0;
              result.usage.cacheWrite += usage.cacheWrite || 0;
              result.usage.cost += usage.cost?.total || 0;
              result.usage.contextTokens = usage.totalTokens || 0;
            }
            if (!result.model && msg.model) result.model = msg.model;
            if (msg.stopReason) result.stopReason = msg.stopReason;
            if (msg.errorMessage) result.errorMessage = msg.errorMessage;
          }
          emitUpdate();
        }

        if (event.type === "tool_result_end" && event.message) {
          result.messages.push(event.message as Message);
          emitUpdate();
        }
      };

      proc.stdout.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) processLine(line);
      });

      proc.stderr.on("data", (data) => {
        result.stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (buffer.trim()) processLine(buffer);
        resolve(code ?? 0);
      });

      proc.on("error", () => {
        resolve(1);
      });

      if (signal) {
        const killProc = () => {
          wasAborted = true;
          proc.kill("SIGTERM");
          setTimeout(() => {
            if (!proc.killed) proc.kill("SIGKILL");
          }, 5000);
        };
        if (signal.aborted) killProc();
        else signal.addEventListener("abort", killProc, { once: true });
      }
    });

    result.exitCode = exitCode;
    if (wasAborted) throw new Error("Agent was aborted");
    return result;
  } finally {
    if (tmpPromptPath)
      try {
        fs.unlinkSync(tmpPromptPath);
      } catch {
        /* ignore */
      }
    if (tmpPromptDir)
      try {
        fs.rmdirSync(tmpPromptDir);
      } catch {
        /* ignore */
      }
  }
}

// ─── schema ───────────────────────────────────────────────────────────────────

const AgentParams = Type.Object({
  prompt: Type.String({
    description: "The task or instruction for the agent",
  }),
  systemPrompt: Type.Optional(
    Type.String({
      description:
        "Full system prompt override. If omitted, inherits the default coding prompt.",
    }),
  ),
  appendSystemPrompt: Type.Optional(
    Type.String({
      description: "Text appended to the default system prompt",
    }),
  ),
  model: Type.Optional(
    Type.String({
      description:
        "Model pattern or ID <provider/model> (e.g. 'zai/glm-4.7', 'zai/glm-5.2', 'github-copilot/claude-haiku-4.5')",
    }),
  ),
  thinking: Type.Optional(
    Type.String({
      description: "Thinking level: off, minimal, low, medium, high, xhigh",
    }),
  ),
  tools: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Allowlist of tool names to enable. If omitted, inherits all available tools.",
    }),
  ),
  excludeTools: Type.Optional(
    Type.Array(Type.String(), {
      description: "Tools to exclude from the inherited set",
    }),
  ),
  cwd: Type.Optional(
    Type.String({
      description: "Working directory for the agent process",
    }),
  ),
});

// ─── extension ────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "agent",
    label: "Agent",
    description: [
      "Delegate tasks to specialized subagents with isolated context.",
      "The subagent works autonomously and returns a single text result.",
      "Override the system prompt, model, tools, and thinking level as needed.",
    ].join(" "),
    parameters: AgentParams,

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const result = await runAgent(ctx.cwd, params, signal, onUpdate);

      const isError =
        result.exitCode !== 0 ||
        result.stopReason === "error" ||
        result.stopReason === "aborted";
      if (isError) {
        const errorMsg =
          result.errorMessage ||
          result.stderr ||
          getFinalOutput(result.messages) ||
          "(no output)";
        return {
          content: [
            {
              type: "text",
              text: `Agent ${result.stopReason || "failed"}: ${errorMsg}`,
            },
          ],
          details: { result },
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: getFinalOutput(result.messages) || "(no output)",
          },
        ],
        details: { result },
      };
    },

    renderCall(args, theme, _context) {
      const parts: string[] = [];
      parts.push(theme.fg("toolTitle", theme.bold("agent ")));
      if (args.model) parts.push(theme.fg("accent", args.model));
      else parts.push(theme.fg("muted", "(default model)"));
      if (args.thinking)
        parts.push(theme.fg("dim", `thinking:${args.thinking}`));

      let text = parts.join(" ");

      const preview = args.prompt
        ? args.prompt.length > 60
          ? `${args.prompt.slice(0, 60)}...`
          : args.prompt
        : "...";
      text += `\n  ${theme.fg("dim", preview)}`;
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded }, theme, _context) {
      const details = result.details as AgentDetails | undefined;
      if (!details || details.result.messages.length === 0) {
        const text = result.content[0];
        return new Text(
          text?.type === "text" ? text.text : "(no output)",
          0,
          0,
        );
      }

      const r = details.result;
      const mdTheme = getMarkdownTheme();
      const isError =
        r.exitCode !== 0 ||
        r.stopReason === "error" ||
        r.stopReason === "aborted";
      const icon = isError ? theme.fg("error", "✗") : theme.fg("success", "✓");
      const displayItems = getDisplayItems(r.messages);
      const finalOutput = getFinalOutput(r.messages);

      const renderDisplayItems = (items: DisplayItem[], limit?: number) => {
        const toShow = limit ? items.slice(-limit) : items;
        const skipped =
          limit && items.length > limit ? items.length - limit : 0;
        let text = "";
        if (skipped > 0)
          text += theme.fg("muted", `... ${skipped} earlier items\n`);
        for (const item of toShow) {
          if (item.type === "text") {
            const preview = expanded
              ? item.text
              : item.text.split("\n").slice(0, 3).join("\n");
            text += `${theme.fg("toolOutput", preview)}\n`;
          } else {
            text += `${theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme))}\n`;
          }
        }
        return text.trimEnd();
      };

      if (expanded) {
        const container = new Container();
        let header = `${icon} ${theme.fg("toolTitle", theme.bold("agent"))}`;
        if (r.model) header += theme.fg("muted", ` (${r.model})`);
        if (isError && r.stopReason)
          header += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
        container.addChild(new Text(header, 0, 0));
        if (isError && r.errorMessage)
          container.addChild(
            new Text(theme.fg("error", `Error: ${r.errorMessage}`), 0, 0),
          );
        container.addChild(new Spacer(1));

        container.addChild(new Text(theme.fg("muted", "─── Output ───"), 0, 0));
        if (displayItems.length === 0 && !finalOutput) {
          container.addChild(new Text(theme.fg("muted", "(no output)"), 0, 0));
        } else {
          for (const item of displayItems) {
            if (item.type === "toolCall")
              container.addChild(
                new Text(
                  theme.fg("muted", "→ ") +
                    formatToolCall(item.name, item.args, theme.fg.bind(theme)),
                  0,
                  0,
                ),
              );
          }
          if (finalOutput) {
            container.addChild(new Spacer(1));
            container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
          }
        }

        const usageStr = formatUsageStats(r.usage, r.model);
        if (usageStr) {
          container.addChild(new Spacer(1));
          container.addChild(new Text(theme.fg("dim", usageStr), 0, 0));
        }
        return container;
      }

      // Collapsed view
      let text = `${icon} ${theme.fg("toolTitle", theme.bold("agent"))}`;
      if (r.model) text += theme.fg("muted", ` (${r.model})`);
      if (isError && r.stopReason)
        text += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
      if (isError && r.errorMessage)
        text += `\n${theme.fg("error", `Error: ${r.errorMessage}`)}`;
      else if (displayItems.length === 0)
        text += `\n${theme.fg("muted", "(no output)")}`;
      else {
        text += `\n${renderDisplayItems(displayItems, COLLAPSED_ITEM_COUNT)}`;
        if (displayItems.length > COLLAPSED_ITEM_COUNT)
          text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
      }
      const usageStr = formatUsageStats(r.usage, r.model);
      if (usageStr) text += `\n${theme.fg("dim", usageStr)}`;
      return new Text(text, 0, 0);
    },
  });
}
