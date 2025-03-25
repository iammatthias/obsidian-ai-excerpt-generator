import {
	App,
	Modal,
	Notice,
	Plugin,
	Setting,
	TFolder,
	normalizePath,
} from "obsidian";
import { AIExcerptPlugin } from "../types";

export class SelectDirectoryModal extends Modal {
	private plugin: AIExcerptPlugin;
	private selectedPath: string = "";

	constructor(app: App, plugin: Plugin & AIExcerptPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Select Directory" });
		contentEl.createEl("p", {
			text: "Choose a directory to process all markdown files within it.",
		});

		// Get all folders in the vault
		const folders = this.getFolders();

		// Create dropdown for folder selection
		new Setting(contentEl)
			.setName("Select Directory")
			.setDesc("Choose the directory to process")
			.addDropdown((dropdown) => {
				// Add all folders to the dropdown
				folders.forEach((folder) => {
					dropdown.addOption(folder.path, folder.path || "Root");
				});

				dropdown.onChange((value) => {
					this.selectedPath = value;
				});

				// Set default value to the first folder
				if (folders.length > 0) {
					this.selectedPath = folders[0].path;
				}
			});

		const buttonContainer = contentEl.createDiv();
		buttonContainer.addClass("ai-excerpt-button-container");

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelButton.addEventListener("click", () => this.close());

		const confirmButton = buttonContainer.createEl("button", {
			text: "Process Directory",
		});
		confirmButton.addClass("mod-cta");
		confirmButton.addEventListener("click", async () => {
			if (this.selectedPath) {
				this.close();
				await this.processSelectedDirectory();
			} else {
				new Notice("Please select a directory");
			}
		});
	}

	getFolders(): TFolder[] {
		const folders: TFolder[] = [];

		// Helper function to recursively get all folders
		const getAllFolders = (folder: TFolder) => {
			folders.push(folder);

			for (const child of folder.children) {
				if (child instanceof TFolder) {
					getAllFolders(child);
				}
			}
		};

		// Start from the root
		getAllFolders(this.app.vault.getRoot());

		return folders;
	}

	async processSelectedDirectory() {
		if (!this.selectedPath) {
			new Notice("No directory selected");
			return;
		}

		// Get the folder from the path
		const folder = this.app.vault.getAbstractFileByPath(
			normalizePath(this.selectedPath)
		);

		if (folder instanceof TFolder) {
			await this.plugin.processDirectory(folder);
		} else {
			new Notice("Invalid directory");
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
