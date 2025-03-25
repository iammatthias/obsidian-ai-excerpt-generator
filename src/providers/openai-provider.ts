import "openai/shims/web";
import OpenAI from "openai";
import { APIError } from "openai";
import { AIExcerptProvider, PromptType } from "../types";
import { Prompts } from "../utils/prompts";

/**
 * OpenAI provider implementation for generating excerpts
 *
 * This provider uses OpenAI's API to generate concise excerpts
 * from document content.
 */
export class OpenAIProvider implements AIExcerptProvider {
	private client: OpenAI;
	private model: string;
	private useChatAPI: boolean;
	private promptType: PromptType;
	private lastUsage: { input: number; output: number } | null = null;

	/**
	 * Creates a new OpenAI provider instance
	 *
	 * @param apiKey - The OpenAI API key
	 * @param model - The OpenAI model to use (e.g., "gpt-4o", "gpt-4", "gpt-3.5-turbo")
	 * @param promptType - The type of prompt to use (default: PromptType.DEFAULT)
	 * @param useChatAPI - Whether to use the Chat API instead of the Completions API (default: true)
	 */
	constructor(
		apiKey: string,
		model: string,
		promptType = PromptType.DEFAULT,
		useChatAPI = true
	) {
		this.client = new OpenAI({
			apiKey: apiKey,
			dangerouslyAllowBrowser: true,
			timeout: 60 * 1000, // 60 seconds
			maxRetries: 2,
		});
		this.model = model;
		this.promptType = promptType;
		this.useChatAPI = useChatAPI;
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
			// Prepare instructions for both API types
			const instructions =
				`Create a very short, informative excerpt from the provided document. ` +
				`Keep your response under ${maxLength} characters. ` +
				`Do not use quotation marks, ellipses (...), or any special formatting in your response. ` +
				`Always provide complete sentences and thoughts, never truncated. ` +
				`Focus on capturing the key points and main theme while matching the original author's style.`;

			let excerptText = "";

			// Use Chat API if specifically requested, otherwise try Responses API first
			if (this.useChatAPI) {
				excerptText = await this._generateWithChatAPI(
					content,
					maxLength
				);
			} else {
				try {
					// Use the Responses API (preferred for file summarization)
					excerptText = await this._generateWithResponsesAPI(
						content,
						instructions
					);
				} catch (error) {
					// Fall back to Chat API if Responses API fails
					console.warn(
						"Falling back to Chat Completions API due to error:",
						error
					);
					excerptText = await this._generateWithChatAPI(
						content,
						maxLength
					);
				}
			}

			// Ensure the excerpt is within the maximum length
			if (excerptText.length > maxLength) {
				// Find the last complete sentence that fits within the limit
				const lastPeriodIndex = excerptText.lastIndexOf(
					".",
					maxLength - 1
				);
				const lastQuestionIndex = excerptText.lastIndexOf(
					"?",
					maxLength - 1
				);
				const lastExclamationIndex = excerptText.lastIndexOf(
					"!",
					maxLength - 1
				);

				// Find the latest ending punctuation within the limit
				const endIndex = Math.max(
					lastPeriodIndex > 0 ? lastPeriodIndex : 0,
					lastQuestionIndex > 0 ? lastQuestionIndex : 0,
					lastExclamationIndex > 0 ? lastExclamationIndex : 0
				);

				// If we found a sentence ending, use it; otherwise trim at max length
				if (endIndex > 0) {
					excerptText = excerptText.substring(0, endIndex + 1);
				} else {
					excerptText = excerptText.substring(0, maxLength);
				}
			}

			return excerptText;
		} catch (error) {
			// Log error details including request ID if available
			if (error instanceof APIError) {
				console.error("OpenAI API Error:", {
					status: error.status,
					name: error.name,
					message: error.message,
					request_id: error.request_id,
				});
			} else {
				console.error("Error calling OpenAI API:", error);
			}

			// Create a user-friendly error message
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new Error(`OpenAI API error: ${errorMessage}`);
		}
	}

	/**
	 * Generate excerpt using the Responses API (preferred for file summarization)
	 * @private
	 */
	private async _generateWithResponsesAPI(
		content: string,
		instructions: string
	): Promise<string> {
		const response = await this.client.responses.create({
			model: this.model,
			instructions,
			input: content,
			temperature: 0.7, // Balanced between creativity and accuracy
		});

		return response.output_text?.trim() || "";
	}

	/**
	 * Generate a concise excerpt using the Chat Completions API
	 */
	private async _generateWithChatAPI(
		content: string,
		maxLength: number
	): Promise<string> {
		// Prepare user prompt with instructions and content
		const userPrompt =
			`Generate a concise excerpt (maximum ${maxLength} characters) that captures the essence of this document. ` +
			`Focus on the main points while matching the author's exact writing style and voice. ` +
			`Never use ellipses (...) - always use complete sentences and thoughts. ` +
			`Avoid generic AI-like phrasing - use the author's own expressions, turns of phrase, and language patterns. ` +
			`The excerpt will be used as a summary in an index or search results.\n\n` +
			`Document:\n${content}`;

		// Make API call to OpenAI
		const response = await this.client.chat.completions.create({
			model: this.model,
			messages: [
				{
					role: "system",
					content: this._getPromptForType(),
				},
				{
					role: "user",
					content: userPrompt,
				},
			],
			max_tokens: 100,
			temperature: 0.3, // Slightly higher temperature for more natural language
		});

		// Process and validate response
		if (!response || response.choices.length === 0) {
			throw new Error("Empty response from OpenAI API");
		}

		// Extract the excerpt text
		return response.choices[0]?.message?.content?.trim() || "";
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
}
