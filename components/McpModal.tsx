"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Wrench,
  Terminal,
  Copy,
  Check,
  Play,
  CheckCircle2,
  Server,
  Cpu,
  Monitor,
  Apple,
} from "lucide-react";
import { MCP_TOOLS } from "@/lib/mcp/definitions";

interface McpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const McpModal: React.FC<McpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"tools" | "connect" | "runtime">("connect");
  const [targetOs, setTargetOs] = useState<"windows" | "posix">("windows");
  const [projectRoot, setProjectRoot] = useState<string>("c:\\Users\\mitesh\\PersonalProjects\\pastor-mike");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ tool: string; output: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Fetch project root and platform from backend
  useEffect(() => {
    if (!isOpen) return;

    async function fetchInfo() {
      try {
        const res = await fetch("/api/mcp");
        if (res.ok) {
          const data = await res.json();
          if (data.projectRoot) {
            setProjectRoot(data.projectRoot);
          }
          if (data.platform === "win32") {
            setTargetOs("windows");
          } else if (data.platform === "darwin" || data.platform === "linux") {
            setTargetOs("posix");
          }
        }
      } catch {
        // Fallback default
      }
    }
    fetchInfo();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleTestTool = async (toolName: string) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      let args: Record<string, unknown> = {};
      if (toolName === "search_scripture") args = { topic_or_keyword: "peace and calm" };
      else if (toolName === "get_verse") args = { reference: "Philippians 4:6-7" };
      else if (toolName === "save_prayer_request") args = { text: "For health and peaceful thoughts." };
      else if (toolName === "save_memory") args = { key: "favorite_passage", value: "Psalm 23" };
      else if (toolName === "load_memory") args = { key: "favorite_passage" };
      else if (toolName === "summarize_session") args = { session_id: "test_session", summary: "Brief pastoral discussion." };

      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolName, arguments: args }),
      });

      const data = await res.json();
      setTestResult({
        tool: toolName,
        output: JSON.stringify(data, null, 2),
      });
    } catch (err) {
      setTestResult({
        tool: toolName,
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Generate verified configuration for Claude Desktop
  const claudeConfig =
    targetOs === "windows"
      ? {
          mcpServers: {
            "pastor-mike": {
              command: "cmd.exe",
              args: ["/c", "npx", "-y", "tsx", "server/mcp_server.ts"],
              cwd: projectRoot,
            },
          },
        }
      : {
          mcpServers: {
            "pastor-mike": {
              command: "npx",
              args: ["-y", "tsx", "server/mcp_server.ts"],
              cwd: projectRoot,
            },
          },
        };

  const claudeConfigSnippet = JSON.stringify(claudeConfig, null, 2);

  // Generate verified configuration for Cursor (~/.cursor/mcp.json)
  const cursorConfig = {
    mcpServers: {
      "pastor-mike": {
        command: targetOs === "windows" ? "cmd.exe" : "npx",
        args:
          targetOs === "windows"
            ? ["/c", "npx", "-y", "tsx", "server/mcp_server.ts"]
            : ["-y", "tsx", "server/mcp_server.ts"],
        cwd: projectRoot,
      },
    },
  };
  const cursorConfigSnippet = JSON.stringify(cursorConfig, null, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-stone-200 bg-[#faf8f5] shadow-2xl dark:border-stone-800 dark:bg-stone-900">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-200/80 px-5 py-4 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-[#445942]/10 p-2 text-[#445942] dark:bg-[#5b7858]/20 dark:text-[#7ba277]">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-100">
                  Model Context Protocol (MCP) & Runtime
                </h2>
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Connect external models or inspect local pastoral tools & persistence
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200/60 bg-stone-50/50 px-5 dark:border-stone-800/60 dark:bg-stone-950/30">
          <button
            onClick={() => setActiveTab("connect")}
            className={`border-b-2 px-4 py-2.5 text-xs font-medium transition ${
              activeTab === "connect"
                ? "border-[#445942] text-[#445942] font-semibold dark:border-[#7ba277] dark:text-[#7ba277]"
                : "border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300"
            }`}
          >
            Connect MCP Clients
          </button>

          <button
            onClick={() => setActiveTab("tools")}
            className={`border-b-2 px-4 py-2.5 text-xs font-medium transition ${
              activeTab === "tools"
                ? "border-[#445942] text-[#445942] font-semibold dark:border-[#7ba277] dark:text-[#7ba277]"
                : "border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300"
            }`}
          >
            Pastoral MCP Tools ({MCP_TOOLS.length})
          </button>

          <button
            onClick={() => setActiveTab("runtime")}
            className={`border-b-2 px-4 py-2.5 text-xs font-medium transition ${
              activeTab === "runtime"
                ? "border-[#445942] text-[#445942] font-semibold dark:border-[#7ba277] dark:text-[#7ba277]"
                : "border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300"
            }`}
          >
            Model Runtime
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: CONNECT MCP CLIENTS */}
          {activeTab === "connect" && (
            <div className="space-y-4">
              {/* OS Selection Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-3 shadow-2xs dark:border-stone-700 dark:bg-stone-800">
                <span className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  Target Operating System:
                </span>
                <div className="flex items-center gap-1.5 rounded-lg bg-stone-100 p-1 dark:bg-stone-900">
                  <button
                    onClick={() => setTargetOs("windows")}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                      targetOs === "windows"
                        ? "bg-white text-stone-900 shadow-xs dark:bg-stone-800 dark:text-stone-100"
                        : "text-stone-500 hover:text-stone-800 dark:text-stone-400"
                    }`}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    <span>Windows (cmd.exe)</span>
                  </button>

                  <button
                    onClick={() => setTargetOs("posix")}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                      targetOs === "posix"
                        ? "bg-white text-stone-900 shadow-xs dark:bg-stone-800 dark:text-stone-100"
                        : "text-stone-500 hover:text-stone-800 dark:text-stone-400"
                    }`}
                  >
                    <Apple className="h-3.5 w-3.5" />
                    <span>macOS / Linux</span>
                  </button>
                </div>
              </div>

              {/* Claude Desktop Configuration */}
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs dark:border-stone-700 dark:bg-stone-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-[#445942] dark:text-[#7ba277]" />
                    <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Claude Desktop Configuration
                    </h3>
                  </div>

                  <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-mono text-stone-600 dark:bg-stone-900 dark:text-stone-400">
                    claude_desktop_config.json
                  </span>
                </div>

                <p className="text-xs text-stone-600 dark:text-stone-300 mb-3 leading-relaxed">
                  Add this block to your Claude Desktop config file (located at{" "}
                  <code className="rounded bg-stone-100 px-1 py-0.5 text-[11px] dark:bg-stone-900">
                    {targetOs === "windows"
                      ? "%APPDATA%\\Claude\\claude_desktop_config.json"
                      : "~/Library/Application Support/Claude/claude_desktop_config.json"}
                  </code>
                  ). Note: On Windows, <code className="font-semibold text-emerald-700 dark:text-emerald-400">cmd.exe</code> and the <code className="font-semibold text-emerald-700 dark:text-emerald-400">cwd</code> parameter are required to resolve Node.js modules.
                </p>

                <div className="relative rounded-lg bg-stone-900 p-3 font-mono text-xs text-stone-100 dark:bg-stone-950">
                  <button
                    onClick={() => handleCopy(claudeConfigSnippet, "claude")}
                    className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded border border-stone-700 bg-stone-800 px-2.5 py-1 text-[11px] text-stone-200 hover:bg-stone-700"
                  >
                    {copiedText === "claude" ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>Copied JSON</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                  <pre className="overflow-x-auto pr-24 leading-relaxed">{claudeConfigSnippet}</pre>
                </div>
              </div>

              {/* Cursor Configuration */}
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs dark:border-stone-700 dark:bg-stone-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-[#445942] dark:text-[#7ba277]" />
                    <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Cursor MCP Settings
                    </h3>
                  </div>

                  <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-mono text-stone-600 dark:bg-stone-900 dark:text-stone-400">
                    Cursor Settings &rarr; MCP
                  </span>
                </div>

                <p className="text-xs text-stone-600 dark:text-stone-300 mb-2.5">
                  In Cursor, navigate to <strong>Cursor Settings &rarr; Features &rarr; MCP &rarr; Add New MCP Server</strong>:
                </p>

                <div className="space-y-1.5 rounded-lg bg-stone-100 p-3 text-xs font-mono dark:bg-stone-900">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Name:</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200">pastor-mike</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Type:</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200">command</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Command:</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200">
                      {targetOs === "windows"
                        ? "cmd.exe /c npx -y tsx server/mcp_server.ts"
                        : "npx -y tsx server/mcp_server.ts"}
                    </span>
                  </div>
                </div>

                <div className="relative mt-3 rounded-lg bg-stone-900 p-3 font-mono text-xs text-stone-100 dark:bg-stone-950">
                  <button
                    onClick={() => handleCopy(cursorConfigSnippet, "cursor")}
                    className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded border border-stone-700 bg-stone-800 px-2.5 py-1 text-[11px] text-stone-200 hover:bg-stone-700"
                  >
                    {copiedText === "cursor" ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>Copied Cursor JSON</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Cursor JSON</span>
                      </>
                    )}
                  </button>
                  <pre className="overflow-x-auto pr-28 leading-relaxed">{cursorConfigSnippet}</pre>
                </div>
              </div>

              {/* Standalone Terminal Command */}
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs dark:border-stone-700 dark:bg-stone-800">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="h-4 w-4 text-[#445942] dark:text-[#7ba277]" />
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Standalone MCP Stdio Server (Terminal)
                  </h3>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-300 mb-2">
                  To test or run the MCP server standalone in your terminal:
                </p>
                <div className="flex items-center justify-between rounded-lg bg-stone-900 px-3 py-2 font-mono text-xs text-emerald-400 dark:bg-stone-950">
                  <span>npm run mcp:server</span>
                  <button
                    onClick={() => handleCopy("npm run mcp:server", "cmd")}
                    className="text-stone-400 hover:text-white"
                  >
                    {copiedText === "cmd" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* HTTP Endpoint */}
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs dark:border-stone-700 dark:bg-stone-800">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="h-4 w-4 text-[#445942] dark:text-[#7ba277]" />
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    HTTP JSON-RPC Gateway
                  </h3>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-300 mb-2">
                  Standard JSON-RPC 2.0 endpoint available when the app is running:
                </p>
                <code className="block rounded-lg bg-stone-100 px-3 py-2 font-mono text-xs text-stone-800 dark:bg-stone-900 dark:text-stone-200">
                  POST http://localhost:3000/api/mcp
                </code>
              </div>
            </div>
          )}

          {/* TAB 2: PASTORAL TOOLS */}
          {activeTab === "tools" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-stone-200 bg-white p-3 text-xs text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
                These tools allow local models and MCP clients to query scripture, record prayers into the SQLite database, and maintain conversational context.
              </div>

              <div className="space-y-3">
                {MCP_TOOLS.map((tool) => (
                  <div
                    key={tool.name}
                    className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-2xs dark:border-stone-700 dark:bg-stone-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-semibold text-[#445942] dark:bg-stone-900 dark:text-[#7ba277]">
                            {tool.name}
                          </code>
                        </div>
                        <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
                          {tool.description}
                        </p>
                      </div>

                      <button
                        onClick={() => handleTestTool(tool.name)}
                        disabled={isTesting}
                        className="flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-750 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-750"
                      >
                        <Play className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Test Call</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Test Result Box */}
              {testResult && (
                <div className="mt-4 rounded-xl border border-stone-300 bg-stone-900 p-3.5 text-stone-100 dark:border-stone-700 dark:bg-stone-950">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800 text-xs text-stone-400">
                    <span>
                      Live Output for: <code>{testResult.tool}</code>
                    </span>
                    <button
                      onClick={() => setTestResult(null)}
                      className="text-stone-400 hover:text-stone-200"
                    >
                      Clear
                    </button>
                  </div>
                  <pre className="max-h-48 overflow-y-auto font-mono text-xs leading-relaxed text-emerald-400">
                    {testResult.output}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RUNTIME */}
          {activeTab === "runtime" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs dark:border-stone-700 dark:bg-stone-800">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="h-4 w-4 text-[#445942] dark:text-[#7ba277]" />
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Current AI Reasoning Engine
                  </h3>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed dark:text-stone-300">
                  The application is configured to run <strong>100% locally and privately</strong> without any external cloud API keys:
                </p>

                <div className="mt-3 space-y-2">
                  <div className="flex items-start gap-2 rounded-lg bg-emerald-50/60 p-3 text-xs text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    <div>
                      <span className="font-semibold">Built-in Offline Pastoral Engine (Active)</span>
                      <p className="text-stone-600 dark:text-stone-400 mt-0.5">
                        Immediately responds to grief, anxiety, guidance, and prayers using the embedded scripture database and crisis detection.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg bg-stone-50 p-3 text-xs text-stone-700 dark:bg-stone-900/60 dark:text-stone-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-stone-400 mt-0.5" />
                    <div>
                      <span className="font-semibold">Local Ollama Runtime Support</span>
                      <p className="text-stone-500 dark:text-stone-400 mt-0.5">
                        If Ollama is running at <code>http://127.0.0.1:11434</code> with models like <code>llama3.2</code>, <code>mistral</code>, or <code>qwen2.5</code>, the orchestrator will automatically route requests through it.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
