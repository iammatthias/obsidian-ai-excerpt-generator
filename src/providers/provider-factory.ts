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
	// Track failed provider attempts to implement cooldown periods
	private static providerCooldowns: Record<string, number> = {};
	private static cooldownDuration: number = 60000; // 1 minute cooldown after failures
	private static activeProviders: Map<string, AIExcerptProvider> = new Map();
	private static maxActiveProviders: number = 2; // Maximum concurrent provider instances

	/**
	 * Check if a provider is in cooldown period after repeated failures
	 * @private
	 */
	private static isProviderInCooldown(provider: LLMProvider): boolean {
		const cooldownUntil = this.providerCooldowns[provider];
		if (cooldownUntil && Date.now() < cooldownUntil) {
			return true;
		}
		return false;
	}

	/**
	 * Put a provider into cooldown after repeated failures
	 * @private
	 */
	private static setProviderCooldown(provider: LLMProvider): void {
		this.providerCooldowns[provider] = Date.now() + this.cooldownDuration;
		console.log(
			`${provider} provider put in cooldown until ${new Date(
				this.providerCooldowns[provider]
			).toISOString()}`
		);
	}

	/**
	 * Clear a provider from cooldown
	 * @private
	 */
	private static clearProviderCooldown(provider: LLMProvider): void {
		delete this.providerCooldowns[provider];
	}

	/**
	 * Creates and returns the appropriate AI provider based on settings
	 *
	 * @param settings - The plugin settings containing provider choice and API keys
	 * @returns An initialized AI provider or null if configuration is invalid
	 */
	static createProvider(
		settings: AIExcerptSettings
	): AIExcerptProvider | null {
		// Check if the requested provider is in cooldown
		if (this.isProviderInCooldown(settings.provider)) {
			console.warn(
				`${settings.provider} is in cooldown period due to previous failures. Trying fallback provider.`
			);
			const fallbackResult = this.createFallbackProvider(
				settings,
				settings.provider
			);
			if (fallbackResult.provider) {
				return fallbackResult.provider;
			}
		}

		// Check if we already have too many active providers
		if (this.activeProviders.size >= this.maxActiveProviders) {
			console.warn(
				`Maximum number of active providers (${this.maxActiveProviders}) reached. Waiting for an available provider.`
			);
			// Instead of creating a new instance, return an existing one to limit concurrent requests
			const existingProvider = this.getExistingProvider(
				settings.provider
			);
			if (existingProvider) {
				return existingProvider;
			}
		}

		// Generate a unique ID for the provider instance
		const providerId = `${settings.provider}-${Date.now()}`;

		switch (settings.provider) {
			case LLMProvider.CLAUDE:
				if (!settings.claudeApiKey) {
					console.warn("Claude API key not provided in settings");
					return null;
				}

				console.log(
					`Creating Claude provider with model: ${settings.claudeModel} and prompt type: ${settings.promptType}`
				);
				const claudeProvider = new ClaudeProvider(
					settings.claudeApiKey,
					settings.claudeModel,
					false, // useStreaming
					settings.promptType
				);

				// Store the provider for reuse
				this.activeProviders.set(providerId, claudeProvider);
				return claudeProvider;

			case LLMProvider.OPENAI:
				if (!settings.openaiApiKey) {
					console.warn("OpenAI API key not provided in settings");
					return null;
				}

				console.log(
					`Creating OpenAI provider with model: ${settings.openaiModel} and prompt type: ${settings.promptType}`
				);
				const openaiProvider = new OpenAIProvider(
					settings.openaiApiKey,
					settings.openaiModel,
					settings.promptType
				);

				// Store the provider for reuse
				this.activeProviders.set(providerId, openaiProvider);
				return openaiProvider;

			default:
				console.error(`Unknown provider: ${settings.provider}`);
				return null;
		}
	}

	/**
	 * Get an existing provider instance of the specified type if available
	 * @private
	 */
	private static getExistingProvider(
		providerType: LLMProvider
	): AIExcerptProvider | null {
		for (const [id, provider] of this.activeProviders.entries()) {
			if (
				(providerType === LLMProvider.CLAUDE &&
					provider instanceof ClaudeProvider) ||
				(providerType === LLMProvider.OPENAI &&
					provider instanceof OpenAIProvider)
			) {
				return provider;
			}
		}
		return null;
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

			// Check if OpenAI is in cooldown
			if (this.isProviderInCooldown(LLMProvider.OPENAI)) {
				console.log(
					`Fallback provider (OpenAI) is also in cooldown. No available providers.`
				);
				return result;
			}

			if (settings.openaiApiKey) {
				console.log(
					`Falling back to OpenAI provider due to Claude API issues`
				);
				const providerId = `${LLMProvider.OPENAI}-${Date.now()}`;
				const openaiProvider = new OpenAIProvider(
					settings.openaiApiKey,
					settings.openaiModel,
					settings.promptType
				);

				// Store the provider for reuse
				this.activeProviders.set(providerId, openaiProvider);
				result.provider = openaiProvider;
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

			// Check if Claude is in cooldown
			if (this.isProviderInCooldown(LLMProvider.CLAUDE)) {
				console.log(
					`Fallback provider (Claude) is also in cooldown. No available providers.`
				);
				return result;
			}

			if (settings.claudeApiKey) {
				console.log(
					`Falling back to Claude provider due to OpenAI API issues`
				);
				const providerId = `${LLMProvider.CLAUDE}-${Date.now()}`;
				const claudeProvider = new ClaudeProvider(
					settings.claudeApiKey,
					settings.claudeModel,
					false, // useStreaming
					settings.promptType
				);

				// Store the provider for reuse
				this.activeProviders.set(providerId, claudeProvider);
				result.provider = claudeProvider;
			} else {
				console.log(
					`Cannot fall back to Claude: API key not configured`
				);
				result.needsConfiguration = true;
			}
		}

		return result;
	}

	/**
	 * Report a provider failure to potentially trigger cooldown
	 * Call this when a provider has failed multiple times to trigger fallback
	 *
	 * @param provider - The provider type that failed
	 */
	static reportProviderFailure(provider: LLMProvider): void {
		this.setProviderCooldown(provider);
	}

	/**
	 * Clean up and remove a provider instance after use
	 * This helps manage resources and provider pools
	 *
	 * @param provider - The provider instance to release
	 */
	static releaseProvider(provider: AIExcerptProvider): void {
		for (const [id, existingProvider] of this.activeProviders.entries()) {
			if (existingProvider === provider) {
				this.activeProviders.delete(id);
				console.log(`Released provider instance ${id}`);
				break;
			}
		}
	}
}
