import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import {
	AIExcerptPlugin,
	AIExcerptSettings,
	CLAUDE_MODELS,
	LLMProvider,
	OPENAI_MODELS,
	PromptType,
} from "./types";

export const DEFAULT_SETTINGS: AIExcerptSettings = {
	provider: LLMProvider.CLAUDE,
	promptType: PromptType.DEFAULT,
	claudeApiKey: "",
	claudeModel: "claude-3-7-sonnet-20250219",
	openaiApiKey: "",
	openaiModel: "gpt-4o",
	maxLength: 140,
};

// Example outputs for different prompt types
export const PROMPT_EXAMPLES = {
	[PromptType.DEFAULT]:
		"This is a concise summary that preserves the original author's unique voice and style. It captures key points while maintaining the same tone as the source.",
	[PromptType.ACADEMIC]:
		"The research demonstrates significant correlations between variables X and Y (p<.001), suggesting theoretical implications for our understanding of the underlying mechanisms as proposed in recent literature.",
	[PromptType.PROFESSIONAL]:
		"Our analysis indicates a 24% increase in quarterly revenue, driven primarily by expansion in the APAC region and improved customer retention rates across enterprise accounts.",
	[PromptType.BLOG]:
		"I've been exploring this fascinating concept for weeks now, and I'm excited to share what I've discovered. It's completely changed how I think about this topic!",
	[PromptType.SIMPLIFIED]:
		"This idea is about how things connect in ways we didn't see before. When we look at the patterns, we can better understand how everything works together.",
	[PromptType.SOCIAL]:
		"Just had a major breakthrough on this project! Can't believe it took me so long to see the connection. This changes everything about how we approach the problem.",
};

export class AIExcerptSettingTab extends PluginSettingTab {
	plugin: AIExcerptPlugin;

	constructor(app: App, plugin: Plugin & AIExcerptPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "AI Excerpt Generator Settings" });

		// LLM Provider Selection
		new Setting(containerEl)
			.setName("AI Provider")
			.setDesc("Select which AI provider to use for generating excerpts")
			.addDropdown((dropdown) => {
				dropdown
					.addOption(LLMProvider.CLAUDE, "Claude (Anthropic)")
					.addOption(LLMProvider.OPENAI, "OpenAI")
					.setValue(this.plugin.settings.provider)
					.onChange(async (value: string) => {
						this.plugin.settings.provider = value as LLMProvider;
						await this.plugin.saveSettings();
						// Reload the settings UI to show/hide provider-specific settings
						this.display();
					});
			});

		// Claude Settings - Only show if Claude is selected
		if (this.plugin.settings.provider === LLMProvider.CLAUDE) {
			containerEl.createEl("h3", { text: "Claude Settings" });

			new Setting(containerEl)
				.setName("Claude API Key")
				.setDesc("Your Anthropic API key for Claude")
				.addText((text) =>
					text
						.setPlaceholder("Enter your API key")
						.setValue(this.plugin.settings.claudeApiKey)
						.onChange(async (value) => {
							this.plugin.settings.claudeApiKey = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("Claude Model")
				.setDesc(
					"Select which Claude model to use. Claude 3.7 Sonnet offers the best balance of quality and speed. Claude 3.5 Haiku is faster but simpler. Claude 3 Opus is highest quality but slower."
				)
				.addDropdown((dropdown) => {
					CLAUDE_MODELS.forEach((model) => {
						dropdown.addOption(model, model);
					});
					dropdown
						.setValue(this.plugin.settings.claudeModel)
						.onChange(async (value) => {
							this.plugin.settings.claudeModel = value;
							await this.plugin.saveSettings();
						});
				});
		}

		// OpenAI Settings - Only show if OpenAI is selected
		if (this.plugin.settings.provider === LLMProvider.OPENAI) {
			containerEl.createEl("h3", { text: "OpenAI Settings" });

			new Setting(containerEl)
				.setName("OpenAI API Key")
				.setDesc("Your OpenAI API key")
				.addText((text) =>
					text
						.setPlaceholder("Enter your API key")
						.setValue(this.plugin.settings.openaiApiKey)
						.onChange(async (value) => {
							this.plugin.settings.openaiApiKey = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("OpenAI Model")
				.setDesc(
					"Select which OpenAI model to use. GPT-4o offers excellent quality and speed. The 'o' series models are specialized for reasoning tasks. GPT-4.5 offers the highest quality but may be slower."
				)
				.addDropdown((dropdown) => {
					OPENAI_MODELS.forEach((model) => {
						dropdown.addOption(model, model);
					});
					dropdown
						.setValue(this.plugin.settings.openaiModel)
						.onChange(async (value) => {
							this.plugin.settings.openaiModel = value;
							await this.plugin.saveSettings();
						});
				});
		}

		// General settings
		containerEl.createEl("h3", { text: "General Settings" });

		// Prompt Type Selection with Examples
		const promptTypeContainer = containerEl.createDiv(
			"prompt-type-settings"
		);

		// Add title for prompt type section
		promptTypeContainer.createEl("div", {
			text: "Prompt Type",
			cls: "setting-item-name",
		});

		promptTypeContainer.createEl("div", {
			text: "Select the style of excerpt to generate",
			cls: "setting-item-description",
		});

		// Create dropdown for prompt types
		const promptDropdownContainer = promptTypeContainer.createDiv(
			"prompt-dropdown-container"
		);
		const promptDropdown = document.createElement("select");
		promptDropdown.className = "dropdown";

		// Add options to dropdown
		Object.values(PromptType).forEach((type) => {
			const option = document.createElement("option");
			option.value = type;

			// Convert enum value to readable name
			const readableName = type
				.replace("excerpt-generation", "Default")
				.replace(/-/g, " ")
				.replace(/(\b\w)/g, (match) => match.toUpperCase());

			option.text = readableName;
			option.selected = this.plugin.settings.promptType === type;
			promptDropdown.appendChild(option);
		});

		promptDropdownContainer.appendChild(promptDropdown);

		// Create example container
		const exampleContainer = promptTypeContainer.createDiv(
			"prompt-example-container"
		);
		exampleContainer.createEl("h4", { text: "Example Output" });

		const exampleText = exampleContainer.createEl("div", {
			cls: "prompt-example-text",
			text: PROMPT_EXAMPLES[this.plugin.settings.promptType],
		});

		// Add some basic styling
		exampleContainer.style.padding = "10px";
		exampleContainer.style.marginTop = "10px";
		exampleContainer.style.backgroundColor = "var(--background-secondary)";
		exampleContainer.style.borderRadius = "5px";

		// Handle dropdown change
		promptDropdown.addEventListener("change", async (e) => {
			const target = e.target as HTMLSelectElement;
			const newType = target.value as PromptType;
			this.plugin.settings.promptType = newType;
			exampleText.textContent = PROMPT_EXAMPLES[newType];
			await this.plugin.saveSettings();
		});

		new Setting(containerEl)
			.setName("Max Excerpt Length")
			.setDesc("Maximum number of characters for generated excerpts")
			.addSlider((slider) =>
				slider
					.setLimits(50, 300, 10)
					.setValue(this.plugin.settings.maxLength)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.maxLength = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
