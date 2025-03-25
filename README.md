# Obsidian AI Excerpt Generator

Generate concise, AI-powered excerpts for your Obsidian notes. This plugin adds or updates an `excerpt` field in your markdown files' frontmatter, making it easier to get a quick overview of your notes when browsing or searching.

## Features

-   Create excerpts for individual notes or process your entire vault
-   Choose between Claude (Anthropic) or OpenAI as your AI provider
-   Select from six distinct writing styles to match your needs
-   Customize excerpt length to fit your preferences
-   Automatic frontmatter creation if needed

## Installation

1. Download the latest release from the [Releases page](https://github.com/iammatthias/obsidian-ai-excerpt-generator/releases)
2. Extract the ZIP into your vault's `.obsidian/plugins` folder
3. Enable the plugin in Obsidian's Community Plugins settings

## Using the Plugin

Start by adding your API key in the plugin settings. You can then generate excerpts by:

-   Using the command palette to run any of the excerpt commands
-   Opening the "AI Excerpt Commands" modal to see all available options
-   Processing a single file, the current directory, a specific directory, or your entire vault

## Configuration Options

### AI Provider Settings

Choose your preferred AI provider (Claude or OpenAI), add your API key, and select a model. You can also adjust the maximum excerpt length (between 50-300 characters) to suit your needs.

The models we support include:

**Claude Models:**

-   Claude 3.7 Sonnet (`claude-3-7-sonnet-20250219`)
-   Claude 3.5 models (Sonnet and Haiku variants)
-   Claude 3 models (Opus, Sonnet, and Haiku)

**OpenAI Models:**

-   O-series models like `o3-mini`, `o1`, and variants
-   GPT models including `gpt-4.5-preview`, `gpt-4o`, `gpt-4`, and `gpt-3.5-turbo`

### Writing Styles

We offer six different prompt styles that produce unique results:

1. **Default** - Keeps the original voice and style while summarizing key points

    > _This concise summary captures the essence while maintaining the author's unique voice and idiomatic expressions._

2. **Academic** - Creates scholarly summaries with appropriate terminology

    > _The research reveals significant correlations between variables, suggesting important theoretical implications for understanding causal mechanisms._

3. **Professional** - Delivers polished, business-appropriate summaries

    > _Analysis shows 24% revenue growth, driven by APAC expansion and improved enterprise retention rates._

4. **Blog** - Produces conversational, engaging excerpts

    > _I've been exploring this fascinating concept and I'm excited to share my discoveries!_

5. **Simplified** - Makes complex content more accessible

    > _This idea shows how things connect in new ways, helping us understand how everything works together._

6. **Social Media** - Creates attention-grabbing, shareable content
    > _Major breakthrough on this project! This changes everything about our approach._

## Getting API Keys

### Claude (Anthropic)

1. Sign up at [Anthropic's website](https://www.anthropic.com)
2. Click your profile icon in the top right and select "API Keys"
3. Create a new key, name it, and copy it immediately (you won't see it again)
4. Paste it into the plugin settings

[More details in Anthropic's documentation](https://docs.anthropic.com/en/api/getting-started)

### OpenAI

1. Create an account at [OpenAI's platform](https://platform.openai.com/signup)
2. Navigate to the [API Keys section](https://platform.openai.com/account/api-keys)
3. Click "Create new secret key" and copy it
4. Add it to the plugin settings

[More details in OpenAI's documentation](https://platform.openai.com/docs/quickstart)

## Behind the Scenes

### Smart Batching

When processing multiple files, the plugin:

-   Works through your files in small batches of 5
-   Adds a short delay between batches to prevent API rate limits
-   Shows progress in the status bar and with notifications

### Provider Fallback

If your primary AI provider has issues, the plugin will try to use your alternative provider (if you've set up both API keys). You'll see notices guiding you if the fallback isn't configured.

## For Developers

### Project Structure

```
src/
├── main.ts                   # Main plugin class and entry point
├── types.ts                  # Type definitions and interfaces
├── settings.ts               # Settings management
├── modals/                   # UI modal dialogs
│   ├── commands-modal.ts     # Modal for accessing all commands
│   ├── generate-all-modal.ts # Modal for "generate all" confirmation
│   └── select-directory-modal.ts # Modal for directory selection
├── providers/                # AI provider implementations
│   ├── claude-provider.ts    # Claude API integration
│   ├── openai-provider.ts    # OpenAI API integration
│   └── provider-factory.ts   # Factory for creating providers
├── prompts/                  # Prompt templates for different styles
│   ├── excerpt-generation.md # Default prompt template
│   ├── academic-summary.md   # Academic style prompt
│   ├── blog-summary.md       # Blog style prompt
│   ├── professional-summary.md # Professional style prompt
│   ├── simplified-summary.md # Simplified style prompt
│   └── social-summary.md     # Social media style prompt
├── services/                 # Core services
│   └── file-processor.ts     # File processing logic
└── utils/                    # Utility functions
    ├── file-utils.ts         # File management utilities
    ├── prompt-loader.ts      # Prompt loading from files
    └── prompts.ts            # Prompt loading and management
```

### Development Workflow

1. Clone the repository
2. Run `npm install` to set up dependencies
3. Use `npm run dev` for development with live reloading
4. Build with `npm run build` for production

## License

This project is available under the Zero-Clause BSD (0BSD) License - see the LICENSE file for details.

## Support

Having issues or questions? Feel free to open an issue on GitHub.

---

**Note**: Using this plugin requires an API key from Anthropic or OpenAI, which may have associated costs. Please check their current pricing before use:

-   [Anthropic Pricing](https://www.anthropic.com/pricing)
-   [OpenAI Pricing](https://openai.com/pricing)
