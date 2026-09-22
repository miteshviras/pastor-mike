import { McpToolResult } from "./types";
import { MCP_TOOLS } from "./definitions";
import { searchScripture, getVerseByReference, ScriptureVerse } from "../scripture/bible-data";
import {
  savePrayerRequest,
  getRecentContext,
  saveMemory,
  loadMemory,
  saveConversationSummary,
  getOrCreateDefaultUser,
} from "../db";

export { MCP_TOOLS };


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
