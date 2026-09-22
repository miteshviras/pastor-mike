#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MCP_TOOLS, executeMcpTool } from "../lib/mcp/tools";

/**
 * Digital Pastor ("Pastor Mike") — Official Model Context Protocol (MCP) Server
 * Exposes scripture lookup, prayer journal saving, memory management, and session recall
 * to external MCP clients (Claude Desktop, Cursor, Antigravity, VS Code, etc.).
 */

const server = new Server(
  {
    name: "pastor-mike-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register list of available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: MCP_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters,
    })),
  };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const toolArgs = (args as Record<string, unknown>) || {};

  const result = await executeMcpTool(name, toolArgs);

  if (!result.success) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing tool '${name}': ${result.error || "Unknown error"}`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Pastor Mike MCP Server running via stdio.");
}

run().catch((err) => {
  console.error("Fatal error in Pastor Mike MCP Server:", err);
  process.exit(1);
});
