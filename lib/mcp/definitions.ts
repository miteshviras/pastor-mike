import { McpToolDefinition } from "./types";

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "search_scripture",
    description: "Search holy scriptures by pastoral topic (e.g. anxiety, grief, rest, courage, forgiveness) or keyword to comfort and ground the believer.",
    parameters: {
      type: "object",
      properties: {
        topic_or_keyword: {
          type: "string",
          description: "The topic, emotional theme, or keyword to search for in scripture (e.g. 'anxiety', 'work burnout', 'loss of loved one').",
        },
      },
      required: ["topic_or_keyword"],
    },
  },
  {
    name: "get_verse",
    description: "Lookup a specific Bible verse by its reference (e.g. 'Philippians 4:6-7', 'Psalm 23', 'Matthew 11:28-30').",
    parameters: {
      type: "object",
      properties: {
        reference: {
          type: "string",
          description: "The scripture reference string to look up.",
        },
      },
      required: ["reference"],
    },
  },
  {
    name: "save_prayer_request",
    description: "Save a believer's prayer request into their personal prayer journal so it can be held in prayer and remembered.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The content of the prayer request.",
        },
        session_id: {
          type: "string",
          description: "Optional session ID associated with this prayer request.",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "get_recent_context",
    description: "Retrieve recent conversation context, active prayer requests, and saved personal memories for the user.",
    parameters: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "The user ID whose context to retrieve (defaults to current user).",
        },
      },
      required: [],
    },
  },
  {
    name: "save_memory",
    description: "Store an important personal fact, spiritual goal, or preference about the user to maintain pastoral continuity.",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "The category or memory key (e.g. 'family_situation', 'spiritual_struggle', 'preferred_translation').",
        },
        value: {
          type: "string",
          description: "The detail to remember.",
        },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "load_memory",
    description: "Load a specific previously stored memory or preference for the user.",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "The key of the memory to look up.",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "summarize_session",
    description: "Save a concise pastoral summary of the current session to ensure continuity across pastoral visits.",
    parameters: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "The session identifier.",
        },
        summary: {
          type: "string",
          description: "A thoughtful, concise summary of what was discussed, what scripture was shared, and what was prayed for.",
        },
      },
      required: ["session_id", "summary"],
    },
  },
];
