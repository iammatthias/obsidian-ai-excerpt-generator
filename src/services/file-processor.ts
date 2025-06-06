import {
	App,
	FileManager,
	Notice,
	TFile,
	TFolder,
	Vault,
	normalizePath,
} from "obsidian";
import { AIExcerptPlugin, AIExcerptSettings, LLMProvider } from "../types";
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
	private plugin: AIExcerptPlugin | null = null;

	/**
	 * Creates a new FileProcessor instance
	 *
	 * @param vault - The Obsidian vault instance
	 * @param fileManager - The Obsidian file manager instance
	 * @param settings - Plugin settings containing API keys and preferences
	 * @param plugin - Reference to the main plugin instance (optional)
	 */
	constructor(
		vault: Vault,
		fileManager: FileManager,
		settings: AIExcerptSettings,
		plugin?: AIExcerptPlugin
	) {
		this.vault = vault;
		this.fileManager = fileManager;
		this.settings = settings;
		this.plugin = plugin || null;
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

					// Release the provider after successful use
					ProviderFactory.releaseProvider(provider);
					return;
				} catch (providerError) {
					// Report provider failure
					ProviderFactory.reportProviderFailure(
						this.settings.provider
					);

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

						try {
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

							// Release the fallback provider after successful use
							ProviderFactory.releaseProvider(
								fallbackResult.provider
							);
							return;
						} catch (fallbackError) {
							// Report fallback provider failure as well
							if (fallbackResult.fallbackType) {
								ProviderFactory.reportProviderFailure(
									fallbackResult.fallbackType
								);
							}

							// Release the fallback provider
							ProviderFactory.releaseProvider(
								fallbackResult.provider
							);

							throw fallbackError;
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

						// Release the provider
						ProviderFactory.releaseProvider(provider);

						// Re-throw the original error
						throw providerError;
					} else {
						// Release the provider
						ProviderFactory.releaseProvider(provider);

						// No fallback available, re-throw the original error
						throw providerError;
					}
				}
			}

			// Extract content without frontmatter for generating excerpt
			const contentWithoutFrontmatter =
				FileUtils.removeFrontmatter(content);

			// Check if excerpt field exists
			const { hasExcerpt } = FileUtils.extractExcerptFromFrontmatter(
				frontmatter!
			);

			// We'll generate a new excerpt regardless of whether one already exists
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

				if (showNotices) {
					if (hasExcerpt) {
						new Notice(
							`Updated excerpt in frontmatter for ${file.name}`
						);
					} else {
						new Notice(
							`Added excerpt field to frontmatter in ${file.name}`
						);
					}
				}

				// Release the provider after successful use
				ProviderFactory.releaseProvider(provider);
			} catch (providerError) {
				// Report provider failure
				ProviderFactory.reportProviderFailure(this.settings.provider);

				// Try fallback provider if primary fails
				const fallbackResult = ProviderFactory.createFallbackProvider(
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
								this.settings.provider === LLMProvider.CLAUDE
									? "Claude"
									: "OpenAI"
							} API failed. Trying ${fallbackName} as fallback...`
						);
					}

					try {
						const excerptText =
							await fallbackResult.provider.generateExcerpt(
								contentWithoutFrontmatter,
								this.settings.maxLength
							);

						// Use fileManager to update frontmatter
						await this.fileManager.processFrontMatter(
							file,
							(frontmatter) => {
								frontmatter["excerpt"] = excerptText;
							}
						);

						if (showNotices) {
							if (hasExcerpt) {
								new Notice(
									`Updated excerpt in frontmatter using ${fallbackName} for ${file.name}`
								);
							} else {
								new Notice(
									`Added excerpt field to frontmatter using ${fallbackName} in ${file.name}`
								);
							}
						}

						// Release the fallback provider after successful use
						ProviderFactory.releaseProvider(
							fallbackResult.provider
						);
					} catch (fallbackError) {
						// Report fallback provider failure as well
						if (fallbackResult.fallbackType) {
							ProviderFactory.reportProviderFailure(
								fallbackResult.fallbackType
							);
						}

						// Release the fallback provider
						ProviderFactory.releaseProvider(
							fallbackResult.provider
						);

						throw fallbackError;
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

					// Release the provider
					ProviderFactory.releaseProvider(provider);

					// Re-throw the original error
					throw providerError;
				} else {
					// Release the provider
					ProviderFactory.releaseProvider(provider);

					// No fallback available, re-throw the original error
					throw providerError;
				}
			}
		} catch (error) {
			if (showNotices)
				new Notice(
					`Error processing file ${file.name}: ${
						error instanceof Error ? error.message : "Unknown error"
					}`
				);
			console.error("Error processing file:", file.name, error);
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
			if (this.plugin) {
				this.plugin.updateStatusBar(0, 0);
			}
			return;
		}

		new Notice(
			`Processing ${files.length} files in ${folder.path} and its subfolders...`
		);

		// Initialize status bar with total files to process
		if (this.plugin) {
			this.plugin.updateStatusBar(0, files.length);
		}

		let processed = 0;
		let errors = 0;
		const batchSize = 5; // Process 5 files at a time

		// Process files in batches to avoid overwhelming the API
		for (let i = 0; i < files.length; i += batchSize) {
			const batch = files.slice(i, i + batchSize);

			// Process each file in the current batch
			for (const file of batch) {
				try {
					await this.processFile(file, false); // Don't show individual notices
					processed++;

					// Update status bar with progress
					if (this.plugin) {
						this.plugin.updateStatusBar(processed, files.length);
					}

					// Show progress updates
					if (processed % 5 === 0 || processed === files.length) {
						new Notice(
							`Processed ${processed}/${files.length} files in ${folder.path} and subfolders`
						);
					}
				} catch (error) {
					console.error(`Error processing ${file.path}:`, error);
					errors++;
				}
			}

			// Add a delay between batches to prevent rate limiting
			if (i + batchSize < files.length) {
				await new Promise((resolve) => setTimeout(resolve, 2000)); // 2-second delay between batches
			}
		}

		// Show final completion notice with success and error counts
		new Notice(
			`Completed. Processed ${processed}/${files.length} files in ${folder.path} and subfolders.` +
				(errors > 0 ? ` Errors: ${errors}` : "")
		);

		// Reset status bar after completion
		setTimeout(() => {
			if (this.plugin) {
				this.plugin.updateStatusBar(0, 0);
			}
		}, 5000); // Reset after 5 seconds
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
		const batchSize = 5; // Process 5 files at a time

		new Notice(`Processing ${files.length} files...`);

		// Initialize status bar with total files to process
		if (this.plugin) {
			this.plugin.updateStatusBar(0, files.length);
		}

		// Process files in batches to avoid overwhelming the API
		for (let i = 0; i < files.length; i += batchSize) {
			const batch = files.slice(i, i + batchSize);

			// Process each file in the current batch
			for (const file of batch) {
				try {
					await this.processFile(file, false); // Don't show individual notices
					processed++;

					// Update status bar with progress
					if (this.plugin) {
						this.plugin.updateStatusBar(processed, files.length);
					}

					// Show progress updates
					if (processed % 5 === 0 || processed === files.length) {
						new Notice(
							`Processed ${processed}/${files.length} files`
						);
					}
				} catch (error) {
					console.error(`Error processing ${file.path}:`, error);
					errors++;
				}
			}

			// Add a delay between batches to prevent rate limiting
			if (i + batchSize < files.length) {
				await new Promise((resolve) => setTimeout(resolve, 2000)); // 2-second delay between batches
			}
		}

		// Show final completion notice with success and error counts
		new Notice(
			`Completed. Processed ${processed}/${files.length} files.` +
				(errors > 0 ? ` Errors: ${errors}` : "")
		);

		// Reset status bar after completion
		setTimeout(() => {
			if (this.plugin) {
				this.plugin.updateStatusBar(0, 0);
			}
		}, 5000); // Reset after 5 seconds
	}
}
