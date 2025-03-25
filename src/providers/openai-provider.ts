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
						maxLength
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

			// Return the excerptText that is already properly processed
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
		maxLength: number
	): Promise<string> {
		// Get the appropriate prompt based on type
		const systemPrompt = this._getPromptForType();

		// Calculate a safe buffer to allow for complete sentences (20% extra but at least 30 chars)
		const safeMaxLength = Math.min(
			maxLength + Math.max(Math.floor(maxLength * 0.2), 30),
			maxLength * 1.5
		);

		// Add specific instructions for max length with emphasis on complete sentences
		const instructions = `${systemPrompt}
		
		Your task is to create a concise excerpt that is under ${maxLength} characters, but you MUST end with a complete sentence or thought.
		
		IMPORTANT RULES:
		- End with a complete sentence - never end mid-sentence
		- Avoid ellipses (...) or any truncation indicators
		- No quotation marks around the output
		- No special formatting
		- If your response is approaching the limit, find a way to complete the thought naturally
		- Track your character count to ensure you don't exceed the limit`;

		const response = await this.client.responses.create({
			model: this.model,
			instructions,
			input: content,
			temperature: 0.7, // Balanced between creativity and accuracy
		});

		let excerptText = response.output_text?.trim() || "";

		// Ensure we have a complete sentence that doesn't exceed maxLength
		return this._ensureCompleteSentence(excerptText, maxLength);
	}

	/**
	 * Generate a concise excerpt using the Chat Completions API
	 */
	private async _generateWithChatAPI(
		content: string,
		maxLength: number
	): Promise<string> {
		// Get the appropriate prompt based on type
		const systemPrompt = this._getPromptForType();

		// Calculate a safe buffer to allow for complete sentences (20% extra but at least 30 chars)
		const safeMaxLength = Math.min(
			maxLength + Math.max(Math.floor(maxLength * 0.2), 30),
			maxLength * 1.5
		);

		// Enhanced system message with clear instructions about complete sentences
		const systemMessage = `${systemPrompt}
		
		Generate a concise excerpt (maximum ${maxLength} characters) that captures the essence of this document.
		
		IMPORTANT RULES:
		- Your entire response must be under ${maxLength} characters
		- Always end with a complete sentence - NEVER end mid-sentence or with a truncated word
		- Do not use ellipses (...) in your response
		- Match the author's writing style and voice
		- If approaching the character limit, find a natural ending point for a complete thought
		- Count your characters carefully to ensure you don't exceed the limit`;

		// Prepare user message with content only
		const userMessage = `Document:\n${content}`;

		// Make API call to OpenAI
		const response = await this.client.chat.completions.create({
			model: this.model,
			messages: [
				{
					role: "system",
					content: systemMessage,
				},
				{
					role: "user",
					content: userMessage,
				},
			],
			max_tokens: 300, // Increased to allow more room for complete sentences
			temperature: 0.3,
		});

		// Process and validate response
		if (!response || response.choices.length === 0) {
			throw new Error("Empty response from OpenAI API");
		}

		// Extract the excerpt text
		let excerptText = response.choices[0]?.message?.content?.trim() || "";

		// Ensure we have a complete sentence that doesn't exceed maxLength
		return this._ensureCompleteSentence(excerptText, maxLength);
	}

	/**
	 * Ensures the excerpt ends with a complete sentence and doesn't exceed maxLength
	 * @private
	 */
	private _ensureCompleteSentence(text: string, maxLength: number): string {
		// If text is already within limits, return it
		if (text.length <= maxLength) {
			return text;
		}

		// Find the last sentence boundary within the max length
		const sentenceEndRegex = /[.!?]\s*(?=[A-Z]|$)/g;
		let lastMatchIndex = -1;

		try {
			const matches = [...text.matchAll(sentenceEndRegex)];

			for (const match of matches) {
				if (match.index !== undefined) {
					// Safe check for index property
					const position = match.index + match[0].length;
					if (position <= maxLength) {
						lastMatchIndex = position;
					} else {
						break;
					}
				}
			}
		} catch (error) {
			console.warn("Error matching sentence boundaries:", error);
			// Continue to the fallback method if regex fails
		}

		// If we found a valid sentence ending, use it
		if (lastMatchIndex > 0) {
			return text.substring(0, lastMatchIndex).trim();
		}

		// Fallback to simpler punctuation-based approach if regex didn't work
		const lastPeriodIndex = text.lastIndexOf(".", maxLength - 1);
		const lastQuestionIndex = text.lastIndexOf("?", maxLength - 1);
		const lastExclamationIndex = text.lastIndexOf("!", maxLength - 1);

		// Find the latest ending punctuation within the limit
		const endIndex = Math.max(
			lastPeriodIndex > 0 ? lastPeriodIndex : 0,
			lastQuestionIndex > 0 ? lastQuestionIndex : 0,
			lastExclamationIndex > 0 ? lastExclamationIndex : 0
		);

		// If we found a sentence ending, use it
		if (endIndex > 0) {
			return text.substring(0, endIndex + 1).trim();
		}

		// Last resort: if the text is longer than maxLength, find a space to break at
		if (text.length > maxLength) {
			const lastSpaceIndex = text.lastIndexOf(" ", maxLength - 1);
			if (lastSpaceIndex > maxLength * 0.75) {
				// Only use if we can keep at least 75% of the text
				return text.substring(0, lastSpaceIndex).trim() + ".";
			}
		}

		// If all else fails, truncate and add a period to simulate a complete sentence
		return text.substring(0, maxLength - 1).trim() + ".";
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
