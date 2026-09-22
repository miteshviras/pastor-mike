#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MCP_TOOLS, executeMcpTool } from "../lib/mcp/tools";
import { recordMcpConnection } from "../lib/db";
import fs from "node:fs";
import path from "node:path";

/**
 * Digital Pastor ("Pastor Mike") — Official Model Context Protocol (MCP) Server
 * Exposes scripture lookup, prayer journal saving, memory management, and session recall
 * to external MCP clients (Antigravity 2.0, Claude Desktop, Cursor, etc.).
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

function updateLiveStatus(clientName: string, clientVersion?: string | null) {
  try {
    recordMcpConnection(clientName, clientVersion || "2.0", "stdio");
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const statusFile = path.join(dataDir, "mcp_status.json");
    fs.writeFileSync(
      statusFile,
      JSON.stringify(
        {
          connected: true,
          client: clientName,
          transport: "stdio",
          tools: MCP_TOOLS.length,
          lastSeen: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch {}
}

// Record when client initializes
server.oninitialized = () => {
  const clientInfo = server.getClientVersion();
  const clientName = clientInfo?.name || "Antigravity 2.0 (Google Antigravity)";
  updateLiveStatus(clientName, clientInfo?.version);
};

// Register list of available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const clientInfo = server.getClientVersion();
  const clientName = clientInfo?.name || "Antigravity 2.0 (Google Antigravity)";
  updateLiveStatus(clientName, clientInfo?.version);

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

  const clientInfo = server.getClientVersion();
  const clientName = clientInfo?.name || "Antigravity 2.0 (Google Antigravity)";
  updateLiveStatus(clientName, clientInfo?.version);

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
  // Mark initial active status upon startup
  updateLiveStatus("Antigravity 2.0 (Google Antigravity)", "2.0");
  await server.connect(transport);
  console.error("Pastor Mike MCP Server running via stdio.");
}

run().catch((err) => {
  console.error("Fatal error in Pastor Mike MCP Server:", err);
  process.exit(1);
});
