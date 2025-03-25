import {
	App,
	FileManager,
	Notice,
	TFile,
	TFolder,
	Vault,
	normalizePath,
} from "obsidian";
import { AIExcerptSettings, LLMProvider } from "../types";
import { ProviderFactory } from "../providers/provider-factory";
import { FileUtils } from "../utils/file-utils";

/**
 * Handles processing of files and directories to add or update excerpts
 * using AI-generated content.
 *
 * This service encapsulates all the logic for:
 * - Reading file content
 * - Detecting and manipulating frontmatter
 * - Requesting AI-generated excerpts from providers
 * - Updating files with new content
 * - Processing files in batch operations
 */
export class FileProcessor {
	private vault: Vault;
	private fileManager: FileManager;
	private settings: AIExcerptSettings;

	/**
	 * Creates a new FileProcessor instance
	 *
	 * @param vault - The Obsidian vault instance
	 * @param fileManager - The Obsidian file manager instance
	 * @param settings - Plugin settings containing API keys and preferences
	 */
	constructor(
		vault: Vault,
		fileManager: FileManager,
		settings: AIExcerptSettings
	) {
		this.vault = vault;
		this.fileManager = fileManager;
		this.settings = settings;
	}

	/**
	 * Process a single file to add or update its excerpt in the frontmatter
	 *
	 * This function will:
	 * 1. Check if the file is a markdown file
	 * 2. Check if the file has frontmatter
	 * 3. Check if the frontmatter has an excerpt field
	 * 4. Generate an excerpt using the configured AI provider if needed
	 * 5. Update the file with the new excerpt
	 *
	 * @param file - The file to process
	 * @param showNotices - Whether to show notification messages for this file
	 * @throws Error if the file processing fails
	 */
	async processFile(file: TFile, showNotices: boolean = true): Promise<void> {
		// Validate file type
		if (!file.extension || file.extension !== "md") {
			if (showNotices) new Notice("Not a markdown file");
			return;
		}

		// Get the AI provider based on settings
		const provider = ProviderFactory.createProvider(this.settings);
		if (!provider) {
			const errorMessage = `AI provider not properly configured. Please check settings.`;
			if (showNotices) new Notice(errorMessage);
			console.error(errorMessage);
			return;
		}

		try {
			// Read file contents
			const content = await this.vault.read(file);

			// Check if the file has frontmatter
			const { hasFrontmatter, frontmatter } =
				FileUtils.extractFrontmatter(content);

			if (!hasFrontmatter) {
				// No frontmatter, add one with excerpt
				const contentWithoutFrontmatter = content;
				try {
					const excerptText = await provider.generateExcerpt(
						contentWithoutFrontmatter,
						this.settings.maxLength
					);

					// For files without frontmatter, we need to add it
					await this.vault.process(file, (data) => {
						return FileUtils.createContentWithExcerpt(
							content,
							excerptText
						);
					});

					if (showNotices)
						new Notice(
							`Added frontmatter with generated excerpt to ${file.name}`
						);
					return;
				} catch (providerError) {
					// Try fallback provider if primary fails
					const fallbackResult =
						ProviderFactory.createFallbackProvider(
							this.settings,
							this.settings.provider
						);

					if (fallbackResult.provider) {
						const fallbackName =
							fallbackResult.fallbackType === LLMProvider.OPENAI
								? "OpenAI"
								: "Claude";

						if (showNotices) {
							new Notice(
								`${
									this.settings.provider ===
									LLMProvider.CLAUDE
										? "Claude"
										: "OpenAI"
								} API failed. Trying ${fallbackName} as fallback...`
							);
						}

						const excerptText =
							await fallbackResult.provider.generateExcerpt(
								contentWithoutFrontmatter,
								this.settings.maxLength
							);

						// For files without frontmatter, we need to add it
						await this.vault.process(file, (data) => {
							return FileUtils.createContentWithExcerpt(
								content,
								excerptText
							);
						});

						if (showNotices) {
							new Notice(
								`Added frontmatter with excerpt using ${fallbackName} to ${file.name}`
							);
						}
						return;
					} else if (fallbackResult.needsConfiguration) {
						const primaryName =
							this.settings.provider === LLMProvider.CLAUDE
								? "Claude"
								: "OpenAI";
						const missingProvider =
							fallbackResult.fallbackType === LLMProvider.OPENAI
								? "OpenAI"
								: "Claude";

						if (showNotices) {
							new Notice(
								`${primaryName} API is currently unavailable, and ${missingProvider} API key is not configured for fallback. Please add your ${missingProvider} API key in settings to enable automatic fallback.`,
								10000 // Show for 10 seconds to ensure user sees it
							);
						}

						// Re-throw the original error
						throw providerError;
					} else {
						// No fallback available, re-throw the original error
						throw providerError;
					}
				}
			}

			// Check if excerpt field exists
			const { hasExcerpt, excerpt } =
				FileUtils.extractExcerptFromFrontmatter(frontmatter!);

			if (!hasExcerpt || !excerpt) {
				// Generate excerpt from content without frontmatter
				const contentWithoutFrontmatter =
					FileUtils.removeFrontmatter(content);

				// Use AI to generate excerpt
				try {
					const excerptText = await provider.generateExcerpt(
						contentWithoutFrontmatter,
						this.settings.maxLength
					);

					// Use fileManager.processFrontMatter to safely update the frontmatter
					await this.fileManager.processFrontMatter(
						file,
						(frontmatter) => {
							frontmatter["excerpt"] = excerptText;
						}
					);

					if (showNotices)
						new Notice(
							`Added excerpt field to frontmatter in ${file.name}`
						);
				} catch (providerError) {
					// Try fallback provider if primary fails
					const fallbackResult =
						ProviderFactory.createFallbackProvider(
							this.settings,
							this.settings.provider
						);

					if (fallbackResult.provider) {
						const fallbackName =
							fallbackResult.fallbackType === LLMProvider.OPENAI
								? "OpenAI"
								: "Claude";

						if (showNotices) {
							new Notice(
								`${
									this.settings.provider ===
									LLMProvider.CLAUDE
										? "Claude"
										: "OpenAI"
								} API failed. Trying ${fallbackName} as fallback...`
							);
						}

						const excerptText =
							await fallbackResult.provider.generateExcerpt(
								contentWithoutFrontmatter,
								this.settings.maxLength
							);

						// Use fileManager.processFrontMatter to safely update the frontmatter
						await this.fileManager.processFrontMatter(
							file,
							(frontmatter) => {
								frontmatter["excerpt"] = excerptText;
							}
						);

						if (showNotices) {
							new Notice(
								`Added excerpt field using ${fallbackName} to ${file.name}`
							);
						}
					} else if (fallbackResult.needsConfiguration) {
						const primaryName =
							this.settings.provider === LLMProvider.CLAUDE
								? "Claude"
								: "OpenAI";
						const missingProvider =
							fallbackResult.fallbackType === LLMProvider.OPENAI
								? "OpenAI"
								: "Claude";

						if (showNotices) {
							new Notice(
								`${primaryName} API is currently unavailable, and ${missingProvider} API key is not configured for fallback. Please add your ${missingProvider} API key in settings to enable automatic fallback.`,
								10000 // Show for 10 seconds to ensure user sees it
							);
						}

						// Re-throw the original error
						throw providerError;
					} else {
						// No fallback available, re-throw the original error
						throw providerError;
					}
				}
			} else {
				// Excerpt field exists and has content, don't modify
				if (showNotices)
					new Notice(`Excerpt already exists in ${file.name}`);
			}
		} catch (error) {
			// Log detailed error for debugging
			console.error(`Error processing file ${file.path}:`, error);

			// Show user-friendly error notification with specific provider name when possible
			if (showNotices) {
				let errorMessage = "";

				if (error instanceof Error) {
					// Try to make the error message more provider-specific
					const providerName =
						this.settings.provider === LLMProvider.CLAUDE
							? "Claude"
							: "OpenAI";
					if (
						error.message.includes("Claude API error") ||
						error.message.includes("Anthropic")
					) {
						errorMessage = error.message.replace(
							"Claude API error",
							`${providerName} API error`
						);
					} else if (error.message.includes("OpenAI API error")) {
						errorMessage = error.message.replace(
							"OpenAI API error",
							`${providerName} API error`
						);
					} else {
						errorMessage = error.message;
					}
				} else {
					errorMessage = String(error);
				}

				new Notice(`Error processing ${file.name}: ${errorMessage}`);
			}

			// Re-throw the error if it needs to be handled by the caller
			throw new Error(
				`Failed to process file ${file.path}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	/**
	 * Process all markdown files in a directory and its subdirectories
	 *
	 * @param folder - The root folder to process
	 * @throws Error if the directory processing fails
	 */
	async processDirectory(folder: TFolder): Promise<void> {
		// Create a function to recursively collect all markdown files
		const collectMarkdownFiles = (folder: TFolder): TFile[] => {
			let markdownFiles: TFile[] = [];

			// First, collect markdown files in the current folder
			folder.children.forEach((child) => {
				if (child instanceof TFile && child.extension === "md") {
					markdownFiles.push(child);
				} else if (child instanceof TFolder) {
					// Recursively collect files from subfolders
					markdownFiles = markdownFiles.concat(
						collectMarkdownFiles(child)
					);
				}
			});

			return markdownFiles;
		};

		// Collect all markdown files from the folder and its subfolders
		const files = collectMarkdownFiles(folder);

		if (files.length === 0) {
			new Notice(
				`No markdown files found in ${folder.path} or its subfolders`
			);
			return;
		}

		new Notice(
			`Processing ${files.length} files in ${folder.path} and its subfolders...`
		);

		let processed = 0;
		let errors = 0;

		for (const file of files) {
			try {
				await this.processFile(file, false); // Don't show individual notices
				processed++;

				// Show progress every 10 files
				if (processed % 10 === 0) {
					new Notice(
						`Processed ${processed}/${files.length} files in ${folder.path} and subfolders`
					);
				}
			} catch (error) {
				console.error(`Error processing ${file.path}:`, error);
				errors++;
			}
		}

		// Show final completion notice with success and error counts
		new Notice(
			`Completed. Processed ${processed}/${files.length} files in ${folder.path} and subfolders.` +
				(errors > 0 ? ` Errors: ${errors}` : "")
		);
	}

	/**
	 * Process all markdown files in the vault
	 *
	 * @throws Error if the vault processing fails
	 */
	async processAllFiles(): Promise<void> {
		const files = this.vault.getMarkdownFiles();
		let processed = 0;
		let errors = 0;

		new Notice(`Processing ${files.length} files...`);

		for (const file of files) {
			try {
				await this.processFile(file, false); // Don't show individual notices
				processed++;

				// Show progress every 10 files
				if (processed % 10 === 0) {
					new Notice(`Processed ${processed}/${files.length} files`);
				}
			} catch (error) {
				console.error(`Error processing ${file.path}:`, error);
				errors++;
			}
		}

		// Show final completion notice with success and error counts
		new Notice(
			`Completed. Processed ${processed}/${files.length} files.` +
				(errors > 0 ? ` Errors: ${errors}` : "")
		);
	}
}
