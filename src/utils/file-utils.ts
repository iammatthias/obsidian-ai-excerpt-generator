import { TFile, Vault } from "obsidian";

/**
 * Utility class for file and frontmatter operations
 *
 * This class provides static methods for working with markdown files
 * and their frontmatter, particularly focused on excerpt management.
 */
export class FileUtils {
	/**
	 * Regular expression for matching YAML frontmatter in markdown files
	 * Matches the entire frontmatter block including the --- delimiters
	 */
	private static readonly FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

	/**
	 * Regular expression for matching the excerpt field in frontmatter
	 */
	private static readonly EXCERPT_REGEX = /^excerpt:\s*(.*)$/m;

	/**
	 * Extracts frontmatter from markdown content if present
	 *
	 * @param content - The markdown file content
	 * @returns Object containing frontmatter information
	 */
	static extractFrontmatter(content: string): {
		hasFrontmatter: boolean;
		frontmatter?: string;
		match?: RegExpMatchArray;
	} {
		if (!content || typeof content !== "string") {
			return { hasFrontmatter: false };
		}

		const frontmatterMatch = content.match(this.FRONTMATTER_REGEX);

		if (!frontmatterMatch) {
			return { hasFrontmatter: false };
		}

		return {
			hasFrontmatter: true,
			frontmatter: frontmatterMatch[1],
			match: frontmatterMatch,
		};
	}

	/**
	 * Checks if frontmatter has an excerpt field and extracts its value
	 *
	 * @param frontmatter - The frontmatter content (without --- delimiters)
	 * @returns Object containing excerpt information
	 */
	static extractExcerptFromFrontmatter(frontmatter: string): {
		hasExcerpt: boolean;
		excerpt?: string;
		match?: RegExpMatchArray;
	} {
		if (!frontmatter || typeof frontmatter !== "string") {
			return { hasExcerpt: false };
		}

		const excerptMatch = frontmatter.match(this.EXCERPT_REGEX);

		if (!excerptMatch) {
			return { hasExcerpt: false };
		}

		return {
			hasExcerpt: true,
			excerpt: excerptMatch[1].trim(),
			match: excerptMatch,
		};
	}

	/**
	 * Removes frontmatter from content for processing
	 *
	 * @param content - The markdown file content
	 * @returns Content with frontmatter removed
	 */
	static removeFrontmatter(content: string): string {
		if (!content || typeof content !== "string") {
			return content || "";
		}

		// Remove frontmatter and any blank lines immediately after it
		return content.replace(/^---\n[\s\S]*?\n---\n\s*/, "");
	}

	/**
	 * Escapes special characters in excerpt text to make it safe for YAML
	 *
	 * @param excerpt - The raw excerpt text
	 * @returns YAML-safe excerpt text
	 */
	static escapeExcerpt(excerpt: string): string {
		if (!excerpt) return "";

		// Escape double quotes and other problematic characters
		return excerpt
			.replace(/"/g, '\\"') // Double quotes need escaping
			.replace(/\n/g, " ") // Replace newlines with spaces
			.trim();
	}

	/**
	 * Creates content with new frontmatter that includes the excerpt
	 *
	 * @param content - The original content (will have frontmatter added)
	 * @param excerpt - The excerpt to add
	 * @returns Content with frontmatter including excerpt
	 */
	static createContentWithExcerpt(content: string, excerpt: string): string {
		if (!content) return "";
		if (!excerpt) return content;

		const escapedExcerpt = this.escapeExcerpt(excerpt);
		return `---\nexcerpt: "${escapedExcerpt}"\n---\n\n${content}`;
	}

	/**
	 * Updates existing frontmatter to include or update excerpt
	 *
	 * @param content - The full file content including frontmatter
	 * @param frontmatter - The extracted frontmatter portion (without delimiters)
	 * @param excerpt - The excerpt to add or update
	 * @returns Updated content with modified frontmatter
	 */
	static updateFrontmatterWithExcerpt(
		content: string,
		frontmatter: string,
		excerpt: string
	): string {
		if (!content || !frontmatter) return content || "";
		if (!excerpt) return content;

		const escapedExcerpt = this.escapeExcerpt(excerpt);
		const excerptMatch = frontmatter.match(this.EXCERPT_REGEX);

		let newFrontmatter: string;
		if (excerptMatch) {
			// Replace existing excerpt
			newFrontmatter = frontmatter.replace(
				this.EXCERPT_REGEX,
				`excerpt: "${escapedExcerpt}"`
			);
		} else {
			// Add excerpt to existing frontmatter
			newFrontmatter = frontmatter + `\nexcerpt: "${escapedExcerpt}"`;
		}

		// Replace old frontmatter with new one
		return content.replace(
			this.FRONTMATTER_REGEX,
			`---\n${newFrontmatter}\n---`
		);
	}
}
