import { App, Menu, Notice, Plugin, TFile, TFolder } from "obsidian";
import { AIExcerptPlugin, AIExcerptSettings } from "./types";
import { DEFAULT_SETTINGS, AIExcerptSettingTab } from "./settings";
import { GenerateAllModal } from "./modals/generate-all-modal";
import { SelectDirectoryModal } from "./modals/select-directory-modal";
import { CommandsModal } from "./modals/commands-modal";
import { FileProcessor } from "./services/file-processor";
import { Prompts } from "./utils/prompts";

/**
 * AI Excerpt Generator Plugin
 *
 * This plugin automatically generates concise excerpts for markdown files in Obsidian
 * using AI models (Claude or OpenAI). It adds or updates the excerpt field in frontmatter.
 *
 * The plugin provides multiple ways to process files:
 * - Current file only
 * - Current directory
 * - Selected directory
 * - All files in vault
 */
export default class AIExcerptGenerator
	extends Plugin
	implements AIExcerptPlugin
{
	settings: AIExcerptSettings;
	fileProcessor: FileProcessor | null;
	statusBarItem: HTMLElement | null = null;

	/**
	 * Initializes the plugin, loads settings, and registers commands and UI elements
	 */
	async onload() {
		await this.loadSettings();

		console.log("Initializing AI Excerpt Generator plugin");

		// Initialize the status bar item
		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar(0, 0);

		// Initialize the prompt system
		try {
			Prompts.initialize(this.app);

			// Load all prompts into memory - primarily from plugin directory, with user customizations if they exist
			try {
				await Prompts.loadAllPrompts();
			} catch (error) {
				console.error("Error loading prompt templates:", error);
				new Notice(
					"Some prompt templates could not be loaded, but the plugin will still function with fallbacks."
				);
			}
		} catch (error) {
			console.error("Critical error initializing prompt system:", error);
			new Notice(
				"Failed to initialize prompt system. The plugin may not function correctly."
			);
		}

		// Initialize the file processor
		this.fileProcessor = new FileProcessor(
			this.app.vault,
			this.app.fileManager,
			this.settings,
			this
		);

		// Add ribbon icon for the plugin
		this.addRibbonIcon(
			"document-text",
			"Generate Excerpt",
			(evt: MouseEvent) => {
				const menu = new Menu();

				menu.addItem((item) => {
					item.setTitle("Current file")
						.setIcon("file-text")
						.onClick(async () => {
							const activeFile =
								this.app.workspace.getActiveFile();
							if (activeFile) {
								await this.processFile(activeFile);
							} else {
								new Notice("No active file");
							}
						});
				});

				menu.addItem((item) => {
					item.setTitle("Current directory")
						.setIcon("folder")
						.onClick(async () => {
							const activeFile =
								this.app.workspace.getActiveFile();
							if (activeFile) {
								const parent = activeFile.parent;
								if (parent) {
									await this.processDirectory(parent);
								}
							} else {
								new Notice(
									"No active file to determine directory"
								);
							}
						});
				});

				menu.addItem((item) => {
					item.setTitle("All files in vault")
						.setIcon("vault")
						.onClick(() => {
							new GenerateAllModal(this.app, this).open();
						});
				});

				// Calculate position for menu
				const rect = (
					evt.currentTarget as HTMLElement
				).getBoundingClientRect();
				menu.showAtPosition({ x: rect.right, y: rect.bottom });
			}
		);

		// Add new ribbon action with scroll-text icon
		this.addRibbonIcon("scroll-text", "AI Excerpt Commands", () => {
			new CommandsModal(this.app, this).open();
		});

		// Add command to generate excerpt for current file
		this.addCommand({
			id: "generate-excerpt-current-file",
			name: "Generate excerpt for current file",
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.extension === "md") {
					if (!checking) {
						this.processFile(activeFile);
					}
					return true;
				}
				return false;
			},
		});

		// Add command to generate excerpts for current directory
		this.addCommand({
			id: "generate-excerpts-current-directory",
			name: "Generate excerpts for current directory",
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.parent) {
					if (!checking) {
						this.processDirectory(activeFile.parent);
					}
					return true;
				}
				return false;
			},
		});

		// Add command to generate excerpts for all files in vault
		this.addCommand({
			id: "generate-excerpts-all-files",
			name: "Generate excerpts for all files in vault",
			callback: async () => {
				new GenerateAllModal(this.app, this).open();
			},
		});

		// Add command to select directory and generate excerpts
		this.addCommand({
			id: "generate-excerpts-select-directory",
			name: "Generate excerpts for a selected directory",
			callback: async () => {
				new SelectDirectoryModal(this.app, this).open();
			},
		});

		// Add command to open commands modal
		this.addCommand({
			id: "open-excerpt-commands-modal",
			name: "Open AI Excerpt Commands",
			callback: () => {
				new CommandsModal(this.app, this).open();
			},
		});

		// Add settings tab
		this.addSettingTab(new AIExcerptSettingTab(this.app, this));
	}

	/**
	 * Clean up resources when the plugin is disabled
	 */
	onunload() {
		// Clean up resources
		console.log("Unloading AI Excerpt Generator plugin");
		this.fileProcessor = null;
		this.statusBarItem = null;
	}

	/**
	 * Load plugin settings from storage
	 */
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	/**
	 * Save plugin settings and reinitialize components that depend on settings
	 */
	async saveSettings() {
		await this.saveData(this.settings);

		// Reload prompt templates
		await Prompts.reload();

		// Re-initialize the file processor with new settings
		this.fileProcessor = new FileProcessor(
			this.app.vault,
			this.app.fileManager,
			this.settings,
			this
		);
	}

	/**
	 * Process a single markdown file to add or update its excerpt
	 * @param file - The file to process
	 * @param showNotices - Whether to show notification messages
	 */
	async processFile(file: TFile, showNotices: boolean = true): Promise<void> {
		if (!this.fileProcessor) {
			new Notice("File processor not initialized");
			return;
		}
		await this.fileProcessor.processFile(file, showNotices);
	}

	/**
	 * Process all markdown files in a directory to add or update excerpts
	 * @param folder - The folder to process
	 */
	async processDirectory(folder: TFolder): Promise<void> {
		if (!this.fileProcessor) {
			new Notice("File processor not initialized");
			return;
		}
		await this.fileProcessor.processDirectory(folder);
	}

	/**
	 * Process all markdown files in the vault to add or update excerpts
	 */
	async processAllFiles(): Promise<void> {
		if (!this.fileProcessor) {
			new Notice("File processor not initialized");
			return;
		}
		await this.fileProcessor.processAllFiles();
	}

	/**
	 * Updates the status bar with current processing information
	 * @param processed - Number of files processed
	 * @param total - Total number of files to process
	 */
	updateStatusBar(processed: number, total: number): void {
		if (this.statusBarItem) {
			if (total > 0) {
				this.statusBarItem.setText(
					`AI Excerpt: ${processed}/${total} files`
				);
				this.statusBarItem.style.display = "block";
			} else {
				this.statusBarItem.setText("AI Excerpt: Ready");
				this.statusBarItem.style.display = "block";
			}
		}
	}
}
