/**
 * MorphLLM Extension — custom compaction via Morph Compact API
 *
 * Hooks into pi's compaction system via the `session_before_compact` event.
 * When MORPH_API_KEY is set, uses the Morph Compact API to generate summaries
 * instead of the built-in LLM summarization.
 *
 * Also registers a `/fast-compact` command as a shortcut to trigger compaction.
 *
 * API docs: https://docs.morphllm.com/compact
 */

import type {
	ExtensionAPI,
	ExtensionCommandContext,
	SessionBeforeCompactEvent,
} from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MORPH_API_URL = "https://api.morphllm.com/v1/compact";
const MAX_OUTPUT_LENGTH = 200_000;
const TRUNCATION_MARKER = "\n\n[compact output truncated at 200,000 characters]";

// ---------------------------------------------------------------------------
// Lazy API key resolution
// ---------------------------------------------------------------------------

function getApiKey(): string | undefined {
	return process.env.MORPH_API_KEY || undefined;
}

// ---------------------------------------------------------------------------
// Session message → Morph messages conversion
// ---------------------------------------------------------------------------

interface ChatMessage {
	role: string;
	content: string;
}

/**
 * Convert AgentMessage[] to simple {role, content} pairs for the Morph API.
 * Skips message types that don't carry text content.
 */
function convertMessages(messages: any[]): ChatMessage[] {
	const result: ChatMessage[] = [];

	for (const msg of messages) {
		const role = msg.role as string;
		if (!msg.content) continue;
		const text = extractTextFromContent(msg.content);
		if (text.trim()) {
			result.push({ role, content: text });
		}
	}

	return result;
}

/**
 * Extract plain text from various content shapes:
 *   - string → string
 *   - Array<{ type: "text", text: string }> → joined text
 */
function extractTextFromContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter((part: any) => part.type === "text" && typeof part.text === "string")
			.map((part: any) => part.text)
			.join("\n");
	}
	return "";
}

// ---------------------------------------------------------------------------
// Morph Compact API call
// ---------------------------------------------------------------------------

interface CompactResponse {
	id: string;
	object: string;
	model: string;
	output: string;
	messages: Array<{
		role: string;
		content: string;
		compacted_line_ranges: Array<{ start: number; end: number }>;
		kept_line_ranges: Array<{ start: number; end: number }>;
	}>;
	usage: {
		input_tokens: number;
		output_tokens: number;
		compression_ratio: number;
		processing_time_ms: number;
	};
}

async function callCompactAPI(
	messages: ChatMessage[],
	query?: string,
	signal?: AbortSignal,
): Promise<CompactResponse> {
	const apiKey = getApiKey();
	if (!apiKey) {
		throw new Error("MORPH_API_KEY environment variable is not set.");
	}

	const body: Record<string, unknown> = { messages };
	if (query) body.query = query;

	const response = await fetch(MORPH_API_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		signal,
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		let detail = "";
		try {
			const parsed = JSON.parse(text);
			detail = parsed.error?.message || parsed.message || text;
		} catch {
			detail = text;
		}

		switch (response.status) {
			case 401:
				throw new Error(
					`Morph authentication failed (401): ${detail}. Check MORPH_API_KEY at https://morphllm.com/dashboard/api-keys`,
				);
			case 400:
				throw new Error(`Morph bad request (400): ${detail}`);
			case 503:
				throw new Error(`Morph model not loaded (503): ${detail}`);
			case 504:
				throw new Error(`Morph request timed out (504): ${detail}`);
			default:
				throw new Error(`Morph API error (${response.status}): ${detail}`);
		}
	}

	return (await response.json()) as CompactResponse;
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function truncateText(text: string): string {
	if (text.length <= MAX_OUTPUT_LENGTH) return text;
	return text.slice(0, MAX_OUTPUT_LENGTH) + TRUNCATION_MARKER;
}

function formatSummary(data: CompactResponse): string {
	const usage = data.usage;
	const reduction = ((1 - usage.compression_ratio) * 100).toFixed(1);
	const lines: string[] = [];

	lines.push(
		`[Morph Compact: ${usage.input_tokens} → ${usage.output_tokens} tokens, ${reduction}% reduction, ${usage.processing_time_ms}ms]`,
	);
	lines.push("");
	lines.push(truncateText(data.output));

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Extension entry
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	// Flag: set by /fast-compact so the hook knows to use Morph instead of
	// letting pi fall through to built-in LLM summarization.
	let morphRequested = false;

	// ── Hook into compaction: use Morph API only when /fast-compact triggers it ─
	pi.on("session_before_compact", async (event: SessionBeforeCompactEvent) => {
		// Only intercept when /fast-compact explicitly requested Morph
		if (!morphRequested) return;
		morphRequested = false; // Consume the flag

		if (!getApiKey()) return;

		const { preparation, customInstructions, signal } = event;

		try {
			const messages = convertMessages(preparation.messagesToSummarize);

			if (messages.length === 0) return;

			const result = await callCompactAPI(messages, customInstructions, signal);

			const summary = formatSummary(result);

			return {
				compaction: {
					summary,
					firstKeptEntryId: preparation.firstKeptEntryId,
					tokensBefore: preparation.tokensBefore,
					details: {
						backend: "morph-compact",
						usage: result.usage,
					},
				},
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error("[morphllm] Compact failed, falling back to built-in:", message);
			// Return undefined → let pi use built-in LLM summarization
		}
	});

	// ── /fast-compact command: trigger compaction via Morph ─────────────────────
	pi.registerCommand("fast-compact", {
		description:
			"Compact current session using Morph Compact API. Usage: /fast-compact [focus query]",

		async handler(args: string, ctx: ExtensionCommandContext) {
			const query = args.trim() || undefined;

			if (!getApiKey()) {
				ctx.ui.notify(
					"MORPH_API_KEY not set. Get a key at https://morphllm.com/dashboard/api-keys",
					"error",
				);
				return;
			}

			// Set flag so our session_before_compact hook intercepts with Morph
			morphRequested = true;

			ctx.compact({
				customInstructions: query,
				onComplete: () => {
					ctx.ui.notify("Morph compact complete.", "info");
				},
				onError: (error: Error) => {
					ctx.ui.notify(`Compact failed: ${error.message}`, "error");
				},
			});
		},
	});
}
