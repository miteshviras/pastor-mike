export interface McpToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export interface McpToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpToolResult {
  tool: string;
  success: boolean;
  data?: unknown;
  error?: string;
}
