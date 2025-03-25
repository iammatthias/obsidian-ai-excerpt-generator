import "@anthropic-ai/sdk/shims/web";
import Anthropic from "@anthropic-ai/sdk";
import { APIError } from "@anthropic-ai/sdk";
import { AIExcerptProvider, PromptType } from "../types";
import { Prompts } from "../utils/prompts";

/**
 * Claude AI provider implementation for generating excerpts
 *
 * This provider uses Anthropic's Claude API to generate concise excerpts
 * from document content.
 */
export class ClaudeProvider implements AIExcerptProvider {
	private client: Anthropic;
	private model: string;
	private useStreaming: boolean;
	private promptType: PromptType;
	private lastUsage: { input: number; output: number } | null = null;
	private retryCount: number = 0;
	private maxRetries: number = 5;
	private lastRequestTime: number = 0;
	private minRequestInterval: number = 500; // 500ms minimum between requests

	/**
	 * Creates a new Claude provider instance
	 *
	 * @param apiKey - The Anthropic API key
	 * @param model - The Claude model to use (e.g., "claude-3-5-sonnet-20240620")
	 * @param useStreaming - Whether to use streaming for longer content (default: false)
	 * @param promptType - The type of prompt to use (default: PromptType.DEFAULT)
	 */
	constructor(
		apiKey: string,
		model: string,
		useStreaming = false,
		promptType = PromptType.DEFAULT
	) {
		this.client = new Anthropic({
			apiKey: apiKey,
			// Set timeout to 60 seconds to prevent hanging requests
			timeout: 60 * 1000,
			// Set max retries for resilience to network issues
			maxRetries: 3,
			// Allow browser usage for Obsidian plugin environment
			dangerouslyAllowBrowser: true,
		});
		this.model = model;
		this.useStreaming = useStreaming;
		this.promptType = promptType;
	}

	/**
	 * Generate a concise excerpt from the provided content
	 *
	 * @param content - The document content to summarize
	 * @param maxLength - Maximum length of the excerpt in characters
	 * @returns A concise excerpt of the document
	 * @throws Error if the API call fails or returns unexpected format
	 */
	async generateExcerpt(content: string, maxLength: number): Promise<string> {
		try {
			// Prepare user prompt with instructions and content
			const userPrompt =
				`Generate a concise excerpt (maximum ${maxLength} characters) that captures the essence of this document. ` +
				`Focus on the main points and be extremely concise. ` +
				`The excerpt will be used as a summary in an index or search results.\n\n` +
				`Document:\n${content}`;

			// Determine whether to use streaming based on content length and configuration
			const shouldUseStreaming =
				this.useStreaming && content.length > 10000;

			let excerptText = "";

			if (shouldUseStreaming) {
				excerptText = await this._generateWithStreaming(userPrompt);
			} else {
				excerptText = await this._generateWithStandardAPI(userPrompt);
			}

			// Ensure the excerpt is within the maximum length
			if (excerptText.length > maxLength) {
				excerptText = excerptText.substring(0, maxLength - 3) + "...";
			}

			// Reset retry count on success
			this.retryCount = 0;

			return excerptText;
		} catch (error) {
			// Enhanced error logging with request IDs when available
			if (error instanceof APIError) {
				console.error("Anthropic API Error:", {
					status: error.status,
					name: error.name,
					message: error.message,
					request_id: error.request_id,
				});

				// Handle rate limiting (429 errors) with exponential backoff
				if (error.status === 429) {
					if (this.retryCount < this.maxRetries) {
						this.retryCount++;

						// Extract retry-after if available in headers
						const retryAfter =
							typeof error.headers === "object" &&
							error.headers &&
							"retry-after" in error.headers
								? parseInt(
										error.headers["retry-after"] as string,
										10
								  ) * 1000
								: null;

						// Calculate delay with exponential backoff or use retry-after if provided
						const delayMs =
							retryAfter ||
							Math.min(
								Math.pow(2, this.retryCount) * 1000 +
									Math.random() * 1000,
								30000 // Cap at 30 seconds
							);

						console.log(
							`Rate limited. Retrying in ${delayMs}ms (attempt ${this.retryCount}/${this.maxRetries})...`
						);

						// Wait for the calculated delay
						await new Promise((resolve) =>
							setTimeout(resolve, delayMs)
						);

						// Retry the request recursively
						return this.generateExcerpt(content, maxLength);
					} else {
						throw new Error(
							"Claude API rate limit exceeded. Maximum retries reached. Please try again in a few minutes."
						);
					}
				} else if (error.status === 529) {
					throw new Error(
						"Claude API is currently overloaded. Please try again in a few minutes."
					);
				} else if (error.status === 401) {
					throw new Error(
						"Invalid Claude API key. Please check your API key in the plugin settings."
					);
				} else if (error.status === 400) {
					throw new Error(
						"Invalid request to Claude API. The content may be too large or contain unsupported content."
					);
				} else if (error.status >= 500) {
					throw new Error(
						"Claude API server error. Please try again later or check Anthropic status page."
					);
				}
			} else {
				console.error("Error calling Anthropic API:", error);
			}

			// Create a user-friendly error message if not already handled above
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new Error(`Claude API error: ${errorMessage}`);
		}
	}

	/**
	 * Ensures rate limiting by waiting if requests are too frequent
	 * @private
	 */
	private async _enforceRateLimit(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;

		if (timeSinceLastRequest < this.minRequestInterval) {
			const waitTime = this.minRequestInterval - timeSinceLastRequest;
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}

		this.lastRequestTime = Date.now();
	}

	/**
	 * Generate excerpt using the standard Messages API
	 * @private
	 */
	private async _generateWithStandardAPI(
		userPrompt: string
	): Promise<string> {
		// Enforce rate limiting
		await this._enforceRateLimit();

		// Make API call to Claude
		const { data: response } = await this.client.messages
			.create({
				model: this.model,
				max_tokens: 100, // Limit token usage for efficiency
				messages: [
					{
						role: "user",
						content: userPrompt,
					},
				],
				system: this._getPromptForType(),
			})
			.withResponse();

		// Store usage data if available
		if (response.usage) {
			this.lastUsage = {
				input: response.usage.input_tokens,
				output: response.usage.output_tokens,
			};
		}

		// Process and validate response
		if (response.content && response.content.length > 0) {
			const contentBlock = response.content[0];
			if ("text" in contentBlock) {
				return contentBlock.text.trim();
			}
		}

		throw new Error("Unexpected response format from Claude API");
	}

	/**
	 * Generate excerpt using the streaming Messages API
	 * Recommended for longer content to prevent timeouts
	 * @private
	 */
	private async _generateWithStreaming(userPrompt: string): Promise<string> {
		// Enforce rate limiting
		await this._enforceRateLimit();

		// Create a stream for the Claude API call
		const stream = await this.client.messages.stream({
			model: this.model,
			max_tokens: 100, // Limit token usage for efficiency
			messages: [
				{
					role: "user",
					content: userPrompt,
				},
			],
			system: this._getPromptForType(),
		});

		// Get the final message which includes the complete response
		const message = await stream.finalMessage();

		// Store usage data if available
		if (message.usage) {
			this.lastUsage = {
				input: message.usage.input_tokens,
				output: message.usage.output_tokens,
			};
		}

		// Process and validate response
		if (message.content && message.content.length > 0) {
			const contentBlock = message.content[0];
			if ("text" in contentBlock) {
				return contentBlock.text.trim();
			}
		}

		throw new Error("Unexpected response format from Claude streaming API");
	}

	/**
	 * Get the appropriate prompt text based on the prompt type
	 * @private
	 */
	private _getPromptForType(): string {
		switch (this.promptType) {
			case PromptType.ACADEMIC:
				return Prompts.academicSummary;
			case PromptType.PROFESSIONAL:
				return Prompts.professionalSummary;
			case PromptType.BLOG:
				return Prompts.blogSummary;
			case PromptType.SIMPLIFIED:
				return Prompts.simplifiedSummary;
			case PromptType.SOCIAL:
				return Prompts.socialSummary;
			case PromptType.DEFAULT:
			default:
				return Prompts.excerptGeneration;
		}
	}

	/**
	 * Get token usage information for the last request if available
	 * Claude provides this through the usage property
	 *
	 * @returns Object containing input and output token counts or null if not available
	 */
	getTokenUsage(): { input: number; output: number } | null {
		return this.lastUsage;
	}
}
