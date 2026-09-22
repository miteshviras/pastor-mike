import { NextRequest, NextResponse } from "next/server";
import { MCP_TOOLS, executeMcpTool } from "@/lib/mcp/tools";
import { recordMcpConnection, listMcpConnections, getActiveMcpClient } from "@/lib/db";

/**
 * HTTP MCP Gateway & Tool Inspector Endpoint
 * Supports JSON-RPC 2.0 and direct HTTP tool calls.
 */

export async function GET() {
  const cwd = process.cwd();
  const isWindows = process.platform === "win32";

  return NextResponse.json({
    status: "online",
    name: "pastor-mike-mcp",
    version: "1.0.0",
    protocolVersion: "2024-11-05",
    description: "Digital Pastor MCP Server providing scripture search, prayer journaling, memory, and session recall.",
    projectRoot: cwd,
    platform: process.platform,
    tools: MCP_TOOLS,
    activeClient: getActiveMcpClient(),
    connections: listMcpConnections(),
    connectionOptions: {
      stdioCommand: "npm run mcp:server",
      claudeDesktopConfigWindows: {
        mcpServers: {
          "pastor-mike": {
            command: "cmd.exe",
            args: ["/c", "npx", "-y", "tsx", "server/mcp_server.ts"],
            cwd: cwd,
          },
        },
      },
      claudeDesktopConfigPosix: {
        mcpServers: {
          "pastor-mike": {
            command: "npx",
            args: ["-y", "tsx", "server/mcp_server.ts"],
            cwd: cwd,
          },
        },
      },
      cursorConfig: {
        mcpServers: {
          "pastor-mike": {
            command: isWindows ? "cmd.exe" : "npx",
            args: isWindows
              ? ["/c", "npx", "-y", "tsx", "server/mcp_server.ts"]
              : ["-y", "tsx", "server/mcp_server.ts"],
            cwd: cwd,
          },
        },
      },
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const clientName = req.headers.get("x-mcp-client") || req.headers.get("user-agent")?.slice(0, 80) || "Unknown HTTP Client";
    recordMcpConnection(clientName, null, "http");

    // 1. Check for standard JSON-RPC 2.0 format
    if (body.jsonrpc === "2.0") {
      const { id, method, params } = body;

      if (method === "tools/list") {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            tools: MCP_TOOLS.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.parameters,
            })),
          },
        });
      }

      if (method === "tools/call") {
        const { name, arguments: toolArgs } = params || {};
        const result = await executeMcpTool(name, toolArgs || {});
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(result.data || { error: result.error }),
              },
            ],
            isError: !result.success,
          },
        });
      }

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    }

    // 2. Direct HTTP Tool Execution
    const toolName = body.tool || body.name;
    const toolArgs = body.arguments || body.args || {};

    if (!toolName) {
      return NextResponse.json({ error: "Field 'tool' or 'name' is required" }, { status: 400 });
    }

    const result = await executeMcpTool(toolName, toolArgs);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
