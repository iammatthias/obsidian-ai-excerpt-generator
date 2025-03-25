# Obsidian AI Excerpt Generator

This is a plugin for [Obsidian](https://obsidian.md) that generates short excerpts for your notes using AI (Claude or OpenAI). It adds or updates the `excerpt` field in the frontmatter of your markdown files.

## Features

-   Generate excerpts for individual files
-   Process entire directories
-   Process all files in your vault
-   Choose between Claude and OpenAI as your AI provider
-   Configure excerpt length and model settings
-   Support for the latest Claude and OpenAI models

## Installation

1. Download the latest release from the Releases section
2. Extract the zip file in your Obsidian vault's `.obsidian/plugins` folder
3. Enable the plugin in Obsidian settings

## Usage

1. Configure your API keys in the plugin settings
2. Use the ribbon icon or commands to generate excerpts:
    - For current file
    - For current directory
    - For a selected directory
    - For all files in your vault

## Configuration

-   **AI Provider**: Choose between Claude (Anthropic) and OpenAI
-   **API Keys**: Enter your API key for the selected provider
-   **Model**: Select the AI model to use (latest models supported)
    -   **Claude Models**: Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus, and more
    -   **OpenAI Models**: GPT-4o, GPT-4.5 Preview, O1, O3-mini, and more
-   **Max Excerpt Length**: Set the maximum length of generated excerpts

## Supported Models

### Claude Models (Anthropic)

-   **Claude 3.7 Sonnet** - Latest and most capable Claude model with excellent quality-to-speed ratio
-   **Claude 3.5 Sonnet** - Great balance between performance and cost
-   **Claude 3.5 Haiku** - Faster, more economical option
-   **Claude 3 Opus** - Highest quality but slower processing

### OpenAI Models

-   **GPT-4.5 Preview** - OpenAI's most capable model
-   **GPT-4o** - Excellent balance of quality and speed
-   **O-series models** (O1, O3-mini, etc.) - Specialized for reasoning tasks
-   **GPT-4/GPT-4 Turbo** - Strong general performance
-   **GPT-3.5 Turbo** - Most economical option

## Project Structure

The plugin is organized into the following modules:

```
src/
├── main.ts                   # Main plugin class and entry point
├── types.ts                  # Type definitions and interfaces
├── settings.ts               # Settings management
├── modals/                   # UI modal dialogs
│   ├── generate-all-modal.ts # Modal for "generate all" confirmation
│   └── select-directory-modal.ts # Modal for directory selection
├── providers/                # AI provider implementations
│   ├── claude-provider.ts    # Claude API integration
│   ├── openai-provider.ts    # OpenAI API integration
│   └── provider-factory.ts   # Factory for creating providers
├── services/                 # Core services
│   └── file-processor.ts     # File processing logic
└── utils/                    # Utility functions
    └── file-utils.ts         # File management utilities
```

## Development

1. Clone this repository
2. Install dependencies with `npm install`
3. Build the plugin with `npm run build`
4. For development, use `npm run dev` to start the build process in watch mode

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter any issues or have questions, please file an issue on the GitHub repository.

---

**Note**: This plugin requires an API key from either Anthropic's Claude AI service or OpenAI's API, which may have associated costs. Please review their pricing and terms before usage.
