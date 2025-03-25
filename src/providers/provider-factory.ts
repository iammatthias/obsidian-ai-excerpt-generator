import { AIExcerptProvider, AIExcerptSettings, LLMProvider } from "../types";
import { ClaudeProvider } from "./claude-provider";
import { OpenAIProvider } from "./openai-provider";

/**
 * Factory for creating AI providers based on plugin settings
 *
 * This factory follows the Factory design pattern to create and configure
 * the appropriate AI provider based on user settings.
 */
export class ProviderFactory {
	/**
	 * Creates and returns the appropriate AI provider based on settings
	 *
	 * @param settings - The plugin settings containing provider choice and API keys
	 * @returns An initialized AI provider or null if configuration is invalid
	 */
	static createProvider(
		settings: AIExcerptSettings
	): AIExcerptProvider | null {
		switch (settings.provider) {
			case LLMProvider.CLAUDE:
				if (!settings.claudeApiKey) {
					console.warn("Claude API key not provided in settings");
					return null;
				}

				console.log(
					`Creating Claude provider with model: ${settings.claudeModel} and prompt type: ${settings.promptType}`
				);
				return new ClaudeProvider(
					settings.claudeApiKey,
					settings.claudeModel,
					false, // useStreaming
					settings.promptType
				);

			case LLMProvider.OPENAI:
				if (!settings.openaiApiKey) {
					console.warn("OpenAI API key not provided in settings");
					return null;
				}

				console.log(
					`Creating OpenAI provider with model: ${settings.openaiModel} and prompt type: ${settings.promptType}`
				);
				return new OpenAIProvider(
					settings.openaiApiKey,
					settings.openaiModel,
					settings.promptType
				);

			default:
				console.error(`Unknown provider: ${settings.provider}`);
				return null;
		}
	}

	/**
	 * Creates a fallback provider when the primary provider fails
	 *
	 * This helps ensure continuity when a provider's API is experiencing issues.
	 * If the primary provider is Claude, it falls back to OpenAI, and vice versa.
	 *
	 * @param settings - The plugin settings
	 * @param primaryProvider - The type of the primary provider that failed
	 * @returns An object containing the fallback provider and status information
	 */
	static createFallbackProvider(
		settings: AIExcerptSettings,
		primaryProvider: LLMProvider
	): {
		provider: AIExcerptProvider | null;
		fallbackType: LLMProvider | null;
		needsConfiguration: boolean;
	} {
		// Default return object
		const result = {
			provider: null as AIExcerptProvider | null,
			fallbackType: null as LLMProvider | null,
			needsConfiguration: false,
		};

		// If primary is Claude, try OpenAI as fallback
		if (primaryProvider === LLMProvider.CLAUDE) {
			result.fallbackType = LLMProvider.OPENAI;

			if (settings.openaiApiKey) {
				console.log(
					`Falling back to OpenAI provider due to Claude API issues`
				);
				result.provider = new OpenAIProvider(
					settings.openaiApiKey,
					settings.openaiModel,
					settings.promptType
				);
			} else {
				console.log(
					`Cannot fall back to OpenAI: API key not configured`
				);
				result.needsConfiguration = true;
			}
		}

		// If primary is OpenAI, try Claude as fallback
		else if (primaryProvider === LLMProvider.OPENAI) {
			result.fallbackType = LLMProvider.CLAUDE;

			if (settings.claudeApiKey) {
				console.log(
					`Falling back to Claude provider due to OpenAI API issues`
				);
				result.provider = new ClaudeProvider(
					settings.claudeApiKey,
					settings.claudeModel,
					false, // useStreaming
					settings.promptType
				);
			} else {
				console.log(
					`Cannot fall back to Claude: API key not configured`
				);
				result.needsConfiguration = true;
			}
		}

		return result;
	}
}
