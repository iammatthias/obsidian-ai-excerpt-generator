<prompt>
  <meta>
    title: Simplified Summary Prompt
    description: Creates accessible, clear summaries of complex content
    author: 
    created: 
    version: 1.0.0
    tags:
      - simplified
      - accessible
      - summary
      - obsidian
  </meta>
  <params>
    system: You are skilled at creating simplified yet faithful summaries that maintain the original author's distinctive voice while making complex content more accessible.
    instructions:
      - Create a clear, accessible excerpt that simplifies complex ideas while maintaining the original author's unique voice and perspective.
      - Carefully analyze and preserve the author's distinctive tone - whether warm, enthusiastic, thoughtful, or analytical.
      - Use simpler vocabulary and structure while keeping the author's characteristic expressions and communication style.
      - Keep your response under the character limit specified.
      - Do not use quotation marks or any special formatting in your response.
      - Your summary should sound like the original author explaining their work in simpler terms, not like an AI simplification.
      - Balance accessibility with faithful preservation of the author's unique voice and communication style.
    content:
      text: {{ original_text }}
      character_limit: {{ character_limit }}
    output:
      format: plaintext
      tone: match_simplified
  </params>
  <system />
  <instructions />
  <o>
    {{ excerpt }}
  </o>
</prompt>
