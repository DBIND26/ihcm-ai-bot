# IHCM Bot Architecture Pack

This folder defines the recommended architecture for building a high-value IHCM AI Bot Widget that is:

- role-specific
- building-aware
- intelligence-driven
- safer than a generic chatbot

Use the files in this order:

1. `KNOWLEDGE_BASE_STRUCTURE.md`
2. `DOCUMENT_INVENTORY.md`
3. `supabase_schema.sql`
4. `PROMPT_ASSEMBLY_PATTERN.md`

What this pack covers:

- the folder structure for the knowledge base
- the exact documents to create first
- a database model for building profiles, knowledge docs, and intelligence
- a prompt and context assembly pattern for the widget runtime

Design principle:

- keep the core bot logic generic
- keep role logic modular
- keep building context structured
- keep intelligence current and separate from static knowledge
