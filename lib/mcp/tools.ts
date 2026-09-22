import { McpToolDefinition, McpToolResult } from "./types";
import { searchScripture, getVerseByReference, ScriptureVerse } from "../scripture/bible-data";
import {
  savePrayerRequest,
  getRecentContext,
  saveMemory,
  loadMemory,
  saveConversationSummary,
  getOrCreateDefaultUser,
} from "../db";

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

export async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  context?: { userId?: string; sessionId?: string }
): Promise<McpToolResult> {
  const defaultUser = getOrCreateDefaultUser();
  const userId = context?.userId || defaultUser.id;

  try {
    switch (toolName) {
      case "search_scripture": {
        const query = (args.topic_or_keyword as string) || "";
        const verses = searchScripture(query);
        return {
          tool: toolName,
          success: true,
          data: {
            query,
            count: verses.length,
            verses: verses.map((v: ScriptureVerse) => ({
              reference: v.reference,
              text: v.text,
              translation: v.translation,
              topic: v.topic,
              pastoralContext: v.pastoralContext,
            })),
          },
        };
      }

      case "get_verse": {
        const reference = (args.reference as string) || "";
        const verse = getVerseByReference(reference);
        if (!verse) {
          return {
            tool: toolName,
            success: false,
            error: `Verse '${reference}' not found in local scripture database.`,
          };
        }
        return {
          tool: toolName,
          success: true,
          data: {
            reference: verse.reference,
            text: verse.text,
            translation: verse.translation,
            topic: verse.topic,
            pastoralContext: verse.pastoralContext,
          },
        };
      }

      case "save_prayer_request": {
        const text = (args.text as string) || "";
        const sessionId = (args.session_id as string) || context?.sessionId || null;
        if (!text.trim()) {
          return { tool: toolName, success: false, error: "Prayer request text cannot be empty." };
        }
        const prayer = savePrayerRequest(userId, text, sessionId);
        return {
          tool: toolName,
          success: true,
          data: prayer,
        };
      }

      case "get_recent_context": {
        const targetUser = (args.user_id as string) || userId;
        const ctx = getRecentContext(targetUser);
        return {
          tool: toolName,
          success: true,
          data: ctx,
        };
      }

      case "save_memory": {
        const key = (args.key as string) || "";
        const value = (args.value as string) || "";
        if (!key.trim() || !value.trim()) {
          return { tool: toolName, success: false, error: "Both key and value are required." };
        }
        saveMemory(userId, key, value);
        return {
          tool: toolName,
          success: true,
          data: { key, value, status: "saved" },
        };
      }

      case "load_memory": {
        const key = (args.key as string) || "";
        const value = loadMemory(userId, key);
        return {
          tool: toolName,
          success: true,
          data: { key, value },
        };
      }

      case "summarize_session": {
        const sessionId = (args.session_id as string) || context?.sessionId || "";
        const summary = (args.summary as string) || "";
        if (!sessionId || !summary) {
          return { tool: toolName, success: false, error: "session_id and summary are required." };
        }
        const record = saveConversationSummary(sessionId, summary);
        return {
          tool: toolName,
          success: true,
          data: record,
        };
      }

      default:
        return {
          tool: toolName,
          success: false,
          error: `Unrecognized MCP tool: '${toolName}'`,
        };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      tool: toolName,
      success: false,
      error: errorMsg,
    };
  }
}
