import { App, Modal, Plugin } from "obsidian";
import { AIExcerptPlugin } from "../types";

export class GenerateAllModal extends Modal {
	private plugin: AIExcerptPlugin;

	constructor(app: App, plugin: Plugin & AIExcerptPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Generate Excerpts for All Files" });
		contentEl.createEl("p", {
			text: "This will check all markdown files in your vault and generate excerpts where needed. This could take some time depending on the size of your vault.",
		});

		const buttonContainer = contentEl.createDiv();
		buttonContainer.addClass("ai-excerpt-button-container");

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelButton.addEventListener("click", () => this.close());

		const confirmButton = buttonContainer.createEl("button", {
			text: "Proceed",
		});
		confirmButton.addClass("mod-cta");
		confirmButton.addEventListener("click", async () => {
			this.close();
			await this.plugin.processAllFiles();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
