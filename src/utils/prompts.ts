import { App, Notice } from "obsidian";
import { PromptLoader } from "./prompt-loader";
import { PromptType } from "../types";

/**
 * Central repository of all prompt templates used in the application
 */
export class Prompts {
	private static promptCache: Record<string, string> = {};
	private static isInitialized = false;
	private static defaultPrompt =
		"Generate a concise summary of the following text in less than 200 words, focusing on the key points and main ideas.";

	/**
	 * Initialize the prompts system with the Obsidian app
	 *
	 * @param app - Obsidian App instance
	 */
	public static initialize(app: App): void {
		PromptLoader.initialize(app);
		this.isInitialized = true;
	}

	/**
	 * Load all prompts into the cache for quick access
	 * This loads from markdown files, not from hardcoded values
	 */
	public static async loadAllPrompts(): Promise<void> {
		if (!this.isInitialized) {
			throw new Error(
				"Prompts system not initialized. Call initialize() first."
			);
		}

		const promptLoadErrors: string[] = [];

		// Ensure default prompt is loaded first as it serves as a fallback
		try {
			this.promptCache.excerptGeneration = await PromptLoader.load(
				PromptType.DEFAULT
			);
		} catch (e) {
			console.error("Failed to load default prompt template", e);
			promptLoadErrors.push(PromptType.DEFAULT);

			// Set a hardcoded default prompt as ultimate fallback
			this.promptCache.excerptGeneration = this.defaultPrompt;
			console.warn("Using hardcoded default prompt as fallback");
		}

		// Load all other prompts, with each in a separate try-catch to isolate failures
		const promptsToLoad = [
			{ type: PromptType.ACADEMIC, cacheName: "academicSummary" },
			{ type: PromptType.PROFESSIONAL, cacheName: "professionalSummary" },
			{ type: PromptType.BLOG, cacheName: "blogSummary" },
			{ type: PromptType.SIMPLIFIED, cacheName: "simplifiedSummary" },
			{ type: PromptType.SOCIAL, cacheName: "socialSummary" },
		];

		// Use Promise.allSettled to load all prompts in parallel without failing on an error
		const results = await Promise.allSettled(
			promptsToLoad.map(async (prompt) => {
				try {
					const content = await PromptLoader.load(prompt.type);
					this.promptCache[prompt.cacheName] = content;
					return { success: true, type: prompt.type };
				} catch (e) {
					console.error(`Failed to load ${prompt.type} prompt`, e);
					promptLoadErrors.push(prompt.type);
					// Use default prompt as fallback
					this.promptCache[prompt.cacheName] =
						this.promptCache.excerptGeneration;
					return { success: false, type: prompt.type, error: e };
				}
			})
		);

		// Report errors if any prompts failed to load
		if (promptLoadErrors.length > 0) {
			const errorMessage = `Failed to load ${
				promptLoadErrors.length
			} prompt templates: ${promptLoadErrors.join(", ")}`;
			console.error(errorMessage);
		}
	}

	/**
	 * Default prompt for general excerpt generation
	 */
	public static get excerptGeneration(): string {
		if (!this.promptCache.excerptGeneration) {
			return this.defaultPrompt;
		}
		return this.promptCache.excerptGeneration;
	}

	/**
	 * Academic summary prompt for scholarly content
	 */
	public static get academicSummary(): string {
		if (!this.promptCache.academicSummary) {
			console.warn("Academic summary prompt not loaded, using default");
			return this.excerptGeneration;
		}
		return this.promptCache.academicSummary;
	}

	/**
	 * Professional summary prompt for formal content
	 */
	public static get professionalSummary(): string {
		if (!this.promptCache.professionalSummary) {
			console.warn(
				"Professional summary prompt not loaded, using default"
			);
			return this.excerptGeneration;
		}
		return this.promptCache.professionalSummary;
	}

	/**
	 * Blog content summary prompt
	 */
	public static get blogSummary(): string {
		if (!this.promptCache.blogSummary) {
			console.warn("Blog summary prompt not loaded, using default");
			return this.excerptGeneration;
		}
		return this.promptCache.blogSummary;
	}

	/**
	 * Simplified summary prompt for accessible content
	 */
	public static get simplifiedSummary(): string {
		if (!this.promptCache.simplifiedSummary) {
			console.warn("Simplified summary prompt not loaded, using default");
			return this.excerptGeneration;
		}
		return this.promptCache.simplifiedSummary;
	}

	/**
	 * Social media summary prompt
	 */
	public static get socialSummary(): string {
		if (!this.promptCache.socialSummary) {
			console.warn("Social summary prompt not loaded, using default");
			return this.excerptGeneration;
		}
		return this.promptCache.socialSummary;
	}

	/**
	 * Reload all prompts from their source files
	 * Useful for development or after prompt updates
	 */
	public static async reload(): Promise<void> {
		PromptLoader.clearCache();
		this.promptCache = {};
		await this.loadAllPrompts();
	}
}
