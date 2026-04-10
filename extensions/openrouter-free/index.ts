/**
 * OpenRouter Free Model Provider
 *
 * Registers a custom provider with pi that exposes configurable "meta models".
 * Each meta model maps to an ordered list of free OpenRouter model IDs.
 * Requests are tried against each model in order, falling back on errors.
 *
 * Config locations (project overrides user):
 *   - ~/.pi/openrouter-free.json    (user-global)
 *   - .pi/openrouter-free.json      (project-local)
 *
 * If no config is found, the extension registers nothing and warns.
 */

import {
	type Api,
	type AssistantMessage,
	type AssistantMessageEventStream,
	type Context,
	createAssistantMessageEventStream,
	type Model,
	type SimpleStreamOptions,
	streamSimpleOpenAICompletions,
} from "@mariozechner/pi-ai";
import { getAgentDir, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// =============================================================================
// Config
// =============================================================================

interface MetaModelConfig {
	/** Display description for this meta model */
	description?: string;
	/** Ordered list of OpenRouter model IDs to try (first = preferred) */
	order: string[];
}

interface ProviderConfig {
	/** API key env var name (e.g. "OPENROUTER_API_KEY") or literal key value */
	apiKey?: string;
	/** Meta model definitions */
	models: Record<string, MetaModelConfig>;
}

const CONFIG_NAME = "openrouter-free.json";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_API_KEY_ENV = "OPENROUTER_API_KEY";

function readJsonFile(filePath: string): Record<string, unknown> | null {
	if (!existsSync(filePath)) return null;
	try {
		return JSON.parse(readFileSync(filePath, "utf-8"));
	} catch (err) {
		console.error(`[openrouter-free] Failed to read ${filePath}: ${err}`);
		return null;
	}
}

function loadConfig(cwd: string): ProviderConfig {
	// User-global config: ~/.pi/openrouter-free.json
	const userDir = getAgentDir(); // ~/.pi/agent
	const userConfigPath = join(userDir, "..", CONFIG_NAME); // ~/.pi/openrouter-free.json
	const userRaw = readJsonFile(userConfigPath);

	// Project-local config: .pi/openrouter-free.json
	const projectConfigPath = join(cwd, ".pi", CONFIG_NAME);
	const projectRaw = readJsonFile(projectConfigPath);

	if (!userRaw && !projectRaw) {
		return { models: {} };
	}

	// Merge: project overrides user
	const merged: ProviderConfig = {
		apiKey: (projectRaw?.apiKey as string) ?? (userRaw?.apiKey as string) ?? DEFAULT_API_KEY_ENV,
		models: {
			...((userRaw?.models as Record<string, MetaModelConfig>) ?? {}),
			...((projectRaw?.models as Record<string, MetaModelConfig>) ?? {}),
		},
	};

	return merged;
}

function resolveApiKey(keyOrEnv: string): string {
	if (/^[A-Z_][A-Z0-9_]*$/.test(keyOrEnv)) {
		return process.env[keyOrEnv] ?? "";
	}
	return keyOrEnv;
}

// =============================================================================
// Stream with Fallback
// =============================================================================

// Cache config per request cycle (loaded once, used by all models)
let cachedConfig: ProviderConfig | null = null;
let cachedConfigCwd: string | null = null;

function getConfig(cwd: string): ProviderConfig {
	if (cachedConfigCwd !== cwd || cachedConfig === null) {
		cachedConfig = loadConfig(cwd);
		cachedConfigCwd = cwd;
	}
	return cachedConfig;
}

function invalidateConfigCache() {
	cachedConfig = null;
	cachedConfigCwd = null;
}

function streamOpenRouterFree(
	model: Model<Api>,
	context: Context,
	options?: SimpleStreamOptions,
): AssistantMessageEventStream {
	const stream = createAssistantMessageEventStream();

	// Determine cwd from context (fall back to process.cwd())
	const cwd = (context as any).cwd ?? process.cwd();
	const config = getConfig(cwd);

	const metaName = model.id;
	const metaConfig = config.models[metaName];

	if (!metaConfig || metaConfig.order.length === 0) {
		const output: AssistantMessage = {
			role: "assistant",
			content: [],
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: {
				input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "error",
			errorMessage: `No models configured for "${metaName}". Create .pi/${CONFIG_NAME} or ~/.pi/${CONFIG_NAME}.`,
			timestamp: Date.now(),
		};
		stream.push({ type: "error", reason: "error", error: output });
		stream.end();
		return stream;
	}

	const apiKey = resolveApiKey(config.apiKey ?? DEFAULT_API_KEY_ENV);
	if (!apiKey) {
		const output: AssistantMessage = {
			role: "assistant",
			content: [],
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: {
				input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "error",
			errorMessage: `No API key. Set ${config.apiKey ?? DEFAULT_API_KEY_ENV} env var.`,
			timestamp: Date.now(),
		};
		stream.push({ type: "error", reason: "error", error: output });
		stream.end();
		return stream;
	}

	(async () => {
		const errors: string[] = [];

		for (const realModelId of metaConfig.order) {
			if (options?.signal?.aborted) {
				const output: AssistantMessage = {
					role: "assistant",
					content: [],
					api: model.api,
					provider: model.provider,
					model: realModelId,
					usage: {
						input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
					stopReason: "aborted",
					timestamp: Date.now(),
				};
				stream.push({ type: "error", reason: "aborted", error: output });
				stream.end();
				return;
			}

			const syntheticModel: Model<"openai-completions"> = {
				id: realModelId,
				name: realModelId,
				api: "openai-completions",
				provider: "openrouter",
				baseUrl: OPENROUTER_BASE_URL,
				reasoning: false,
				input: ["text", "image"] as ("text" | "image")[],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: model.contextWindow,
				maxTokens: model.maxTokens,
				headers: {},
			};

			try {
				const innerStream = streamSimpleOpenAICompletions(
					syntheticModel,
					context,
					{
						apiKey,
						signal: options?.signal,
						maxTokens: options?.maxTokens,
						temperature: options?.temperature,
					},
				);

				let gotError = false;
				let errorMsg = "";

				for await (const event of innerStream) {
					if (event.type === "error") {
						gotError = true;
						const errData = event as { type: "error"; reason: string; error: AssistantMessage };
						errorMsg = errData.error.errorMessage ?? errData.reason;
						break;
					}
					stream.push(event);
				}

				if (!gotError) {
					return; // Success
				}

				errors.push(`${realModelId}: ${errorMsg}`);
				console.error(`[openrouter-free] ${realModelId} failed: ${errorMsg}`);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				errors.push(`${realModelId}: ${msg}`);
				console.error(`[openrouter-free] ${realModelId} threw: ${msg}`);
			}
		}

		// All models failed
		const output: AssistantMessage = {
			role: "assistant",
			content: [],
			api: model.api,
			provider: model.provider,
			model: metaName,
			usage: {
				input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "error",
			errorMessage: `All models exhausted for "${metaName}":\n${errors.join("\n")}`,
			timestamp: Date.now(),
		};
		stream.push({ type: "error", reason: "error", error: output });
		stream.end();
	})();

	return stream;
}

// =============================================================================
// Extension Entry Point
// =============================================================================

export default function (pi: ExtensionAPI) {
	// Initial registration from cwd at load time
	const config = getConfig(process.cwd());

	if (Object.keys(config.models).length === 0) {
		console.error(
			`[openrouter-free] No models configured. ` +
			`Create ~/.pi/${CONFIG_NAME} or .pi/${CONFIG_NAME} with your meta models.`,
		);
		return;
	}

	const models = Object.entries(config.models).map(([name, def]) => ({
		id: name,
		name: def.description ? `OR Free: ${name} — ${def.description}` : `OR Free: ${name}`,
		reasoning: false,
		input: ["text", "image"] as ("text" | "image")[],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 200000,
		maxTokens: 16384,
	}));

	pi.registerProvider("openrouter-free", {
		baseUrl: OPENROUTER_BASE_URL,
		apiKey: config.apiKey ?? DEFAULT_API_KEY_ENV,
		api: "openrouter-free-api" as any,
		authHeader: true,
		models,
		streamSimple: streamOpenRouterFree,
	});

	console.log(`[openrouter-free] Registered ${models.length} meta models: ${models.map((m) => m.id).join(", ")}`);

	// Re-register on session start to pick up config changes
	pi.on("session_start", async () => {
		invalidateConfigCache();
		const newConfig = getConfig(process.cwd());
		if (Object.keys(newConfig.models).length === 0) {
			pi.unregisterProvider("openrouter-free");
			return;
		}
		pi.unregisterProvider("openrouter-free");
		const newModels = Object.entries(newConfig.models).map(([name, def]) => ({
			id: name,
			name: def.description ? `OR Free: ${name} — ${def.description}` : `OR Free: ${name}`,
			reasoning: false,
			input: ["text", "image"] as ("text" | "image")[],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 200000,
			maxTokens: 16384,
		}));
		pi.registerProvider("openrouter-free", {
			baseUrl: OPENROUTER_BASE_URL,
			apiKey: newConfig.apiKey ?? DEFAULT_API_KEY_ENV,
			api: "openrouter-free-api" as any,
			authHeader: true,
			models: newModels,
			streamSimple: streamOpenRouterFree,
		});
		console.log(`[openrouter-free] Reloaded ${newModels.length} meta models`);
	});
}
