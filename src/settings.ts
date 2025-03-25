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

// Base examples for different prompt types (will be adapted based on length)
export const PROMPT_EXAMPLES = {
	[PromptType.DEFAULT]: {
		short: "This concise summary captures the essence while maintaining the author's unique voice and idiomatic expressions.",
		medium: "This concise summary preserves the original author's distinctive voice and writing style. It captures key points while maintaining the same tone, word choice, and sentence structures found in the source material.",
		long: "This comprehensive summary perfectly mirrors the original author's distinctive voice and writing style. It captures all key points while maintaining the same tone, pacing, idiomatic expressions, and sentence structures found in the source material. Every sentence feels authentic to the author's writing - never generic or AI-generated.",
	},
	[PromptType.ACADEMIC]: {
		short: "The research reveals significant correlations between variables, suggesting important theoretical implications for understanding causal mechanisms.",
		medium: "The research demonstrates statistically significant correlations between variables X and Y (p<.001), suggesting theoretical implications for our understanding of underlying mechanisms as proposed in recent literature.",
		long: "The research methodology reveals statistically significant correlations between variables X and Y (p<.001), suggesting important theoretical implications for our understanding of causal mechanisms. These findings align with hypotheses proposed in recent literature while extending the conceptual framework through novel analytical approaches and methodological innovations.",
	},
	[PromptType.PROFESSIONAL]: {
		short: "Analysis shows 24% revenue growth, driven by APAC expansion and improved enterprise retention rates.",
		medium: "Our analysis indicates a 24% increase in quarterly revenue, driven primarily by expansion in the APAC region and improved customer retention rates across enterprise accounts.",
		long: "Our comprehensive analysis indicates a 24% increase in quarterly revenue, driven primarily by strategic expansion in the APAC region and significantly improved customer retention rates across enterprise accounts. These results exceed projections by 7 percentage points and position us favorably for continued growth in the next fiscal period.",
	},
	[PromptType.BLOG]: {
		short: "I've been exploring this fascinating concept and I'm excited to share my discoveries!",
		medium: "I've been exploring this fascinating concept for weeks now, and I'm excited to share what I've discovered. It's completely changed how I think about this topic!",
		long: "I've been absolutely obsessed with exploring this fascinating concept for the past few weeks, and I'm super excited to finally share what I've discovered with all of you! It's completely changed how I think about this topic, and I'm betting it might just revolutionize your perspective too!",
	},
	[PromptType.SIMPLIFIED]: {
		short: "This idea shows how things connect in new ways, helping us understand how everything works together.",
		medium: "This idea is about how things connect in ways we didn't see before. When we look at the patterns, we can better understand how everything works together.",
		long: "This idea is about how different things connect in ways we didn't notice before. When we take time to look at the patterns more carefully, we can better understand how everything works together. This helps us solve problems by seeing the whole picture instead of just separate parts.",
	},
	[PromptType.SOCIAL]: {
		short: "Major breakthrough on this project! This changes everything about our approach.",
		medium: "Just had a major breakthrough on this project! Can't believe it took me so long to see the connection. This changes everything about how we approach the problem.",
		long: "Just had the BIGGEST breakthrough on this project! 🤯 Can't believe it took me so long to see the connection that was right in front of me the whole time. This completely changes everything about how we've been approaching the problem. So excited to share more details soon!",
	},
};

// Helper function to get appropriately sized example based on length setting
function getExampleForLength(type: PromptType, length: number): string {
	if (length <= 100) {
		return PROMPT_EXAMPLES[type].short;
	} else if (length <= 200) {
		return PROMPT_EXAMPLES[type].medium;
	} else {
		return PROMPT_EXAMPLES[type].long;
	}
}

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

		// Max Length Slider (moved before prompt type)
		let currentMaxLength = this.plugin.settings.maxLength;
		const lengthSetting = new Setting(containerEl)
			.setName("Max Excerpt Length")
			.setDesc("Maximum number of characters for generated excerpts")
			.addSlider((slider) =>
				slider
					.setLimits(50, 300, 10)
					.setValue(currentMaxLength)
					.setDynamicTooltip()
					.onChange(async (value) => {
						currentMaxLength = value;
						this.plugin.settings.maxLength = value;

						// Update example text if it exists
						const exampleText = containerEl.querySelector(
							".prompt-example-text"
						);
						if (exampleText) {
							exampleText.textContent = getExampleForLength(
								this.plugin.settings.promptType,
								value
							);
						}

						await this.plugin.saveSettings();
					})
			);

		// Prompt Type Selection with Examples
		new Setting(containerEl)
			.setName("Prompt Type")
			.setDesc("Select the style of excerpt to generate")
			.addDropdown((dropdown) => {
				dropdown
					.addOption(PromptType.DEFAULT, "Default")
					.addOption(PromptType.ACADEMIC, "Academic")
					.addOption(PromptType.PROFESSIONAL, "Professional")
					.addOption(PromptType.BLOG, "Blog")
					.addOption(PromptType.SIMPLIFIED, "Simplified")
					.addOption(PromptType.SOCIAL, "Social Media")
					.setValue(this.plugin.settings.promptType)
					.onChange(async (value: string) => {
						const newType = value as PromptType;
						this.plugin.settings.promptType = newType;

						// Update example text
						const exampleText = containerEl.querySelector(
							".prompt-example-text"
						);
						if (exampleText) {
							exampleText.textContent = getExampleForLength(
								newType,
								currentMaxLength
							);
						}

						await this.plugin.saveSettings();
					});
			});

		// Example Output Section
		const exampleContainer = containerEl.createDiv(
			"prompt-example-container"
		);
		exampleContainer.createEl("h4", { text: "Example Output" });

		exampleContainer.createEl("div", {
			cls: "prompt-example-text",
			text: getExampleForLength(
				this.plugin.settings.promptType,
				currentMaxLength
			),
		});
	}
}
