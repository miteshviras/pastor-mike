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
  Wifi,
  WifiOff,
  Bot,
} from "lucide-react";
import { MCP_TOOLS } from "@/lib/mcp/definitions";
import type { McpConnection } from "@/lib/db";

interface McpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ClientId = "claude" | "cursor" | "antigravity" | "codex";

interface ClientDef {
  id: ClientId;
  label: string;
  format: "json" | "toml";
  configFile: (os: "windows" | "posix") => string;
  instructions?: string;
}

const MCP_CLIENTS: ClientDef[] = [
  {
    id: "claude",
    label: "Claude Desktop",
    format: "json",
    configFile: (os) =>
      os === "windows"
        ? "%APPDATA%\\Claude\\claude_desktop_config.json"
        : "~/Library/Application Support/Claude/claude_desktop_config.json",
  },
  {
    id: "cursor",
    label: "Cursor",
    format: "json",
    configFile: () => "~/.cursor/mcp.json",
    instructions: "Or via Cursor Settings \u2192 Features \u2192 MCP \u2192 Add New MCP Server.",
  },
  {
    id: "antigravity",
    label: "Antigravity",
    format: "json",
    configFile: (os) =>
      os === "windows"
        ? "%USERPROFILE%\\.gemini\\config\\mcp_config.json"
        : "~/.gemini/config/mcp_config.json",
    instructions: "Workspace-local alternative: .agents/mcp_config.json in this project.",
  },
  {
    id: "codex",
    label: "Codex CLI",
    format: "toml",
    configFile: () => "~/.codex/config.toml",
  },
];

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Pure fetch, no setState here, so it's safe to call from both an effect and an event handler
async function fetchMcpInfo(): Promise<{
  projectRoot?: string;
  platform?: string;
  connections?: McpConnection[];
} | null> {
  try {
    const res = await fetch("/api/mcp");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export const McpModal: React.FC<McpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"tools" | "connect" | "runtime">("connect");
  const [targetOs, setTargetOs] = useState<"windows" | "posix">("windows");
  const [projectRoot, setProjectRoot] = useState<string>("c:\\Users\\mitesh\\PersonalProjects\\pastor-mike");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ tool: string; output: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientId>("claude");
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [lastPolledAt, setLastPolledAt] = useState(0);

  // Fetch project root, platform, and currently-connected MCP clients, then poll while open
  // so newly-connected clients (stdio or HTTP) show up live.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function poll() {
      const data = await fetchMcpInfo();
      if (cancelled || !data) return;
      if (data.projectRoot) setProjectRoot(data.projectRoot);
      if (data.platform === "win32") setTargetOs("windows");
      else if (data.platform === "darwin" || data.platform === "linux") setTargetOs("posix");
      if (Array.isArray(data.connections)) setConnections(data.connections);
      setLastPolledAt(Date.now());
    }

    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
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
        headers: { "Content-Type": "application/json", "X-MCP-Client": "Pastor Mike Web UI (Test Console)" },
        body: JSON.stringify({ tool: toolName, arguments: args }),
      });

      const data = await res.json();
      setTestResult({
        tool: toolName,
        output: JSON.stringify(data, null, 2),
      });
      // The Connected Clients panel picks this test call up on its next 4s poll tick
    } catch (err) {
      setTestResult({
        tool: toolName,
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // All four clients launch the same stdio command; only the file format and Windows
  // cmd.exe wrapping differ.
  const command = targetOs === "windows" ? "cmd.exe" : "npx";
  const args =
    targetOs === "windows"
      ? ["/c", "npx", "-y", "tsx", "server/mcp_server.ts"]
      : ["-y", "tsx", "server/mcp_server.ts"];

  const jsonConfigSnippet = JSON.stringify(
    { mcpServers: { "pastor-mike": { command, args, cwd: projectRoot } } },
    null,
    2
  );

  const tomlConfigSnippet = [
    "[mcp_servers.pastor-mike]",
    `command = ${JSON.stringify(command)}`,
    `args = ${JSON.stringify(args)}`,
    `cwd = ${JSON.stringify(projectRoot)}`,
  ].join("\n");

  const activeClient = MCP_CLIENTS.find((c) => c.id === selectedClient)!;
  const activeSnippet = activeClient.format === "toml" ? tomlConfigSnippet : jsonConfigSnippet;

  const isLive = (iso: string) => lastPolledAt > 0 && lastPolledAt - new Date(iso).getTime() < 15000;

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
              {/* Connected Clients */}
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs dark:border-stone-700 dark:bg-stone-800">
                <div className="flex items-center gap-2 mb-3">
                  <Wifi className="h-4 w-4 text-[#445942] dark:text-[#7ba277]" />
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Connected MCP Clients
                  </h3>
                </div>

                {connections.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2.5 text-xs text-stone-500 dark:bg-stone-900/60 dark:text-stone-400">
                    <WifiOff className="h-3.5 w-3.5 shrink-0" />
                    <span>No MCP client has connected yet. Add a config below, then open or restart that client.</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {connections.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-xs dark:bg-stone-900/60"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Bot className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                          <span className="truncate font-medium text-stone-800 dark:text-stone-200">
                            {c.client_name}
                          </span>
                          {c.client_version && (
                            <span className="shrink-0 text-stone-400 dark:text-stone-500">v{c.client_version}</span>
                          )}
                          <span className="shrink-0 rounded bg-stone-200/70 px-1.5 py-0.5 text-[10px] text-stone-600 dark:bg-stone-800 dark:text-stone-400">
                            {c.transport}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 pl-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isLive(c.last_seen_at) ? "bg-emerald-500 animate-pulse" : "bg-stone-300 dark:bg-stone-600"
                            }`}
                          />
                          <span className="text-stone-500 dark:text-stone-400">{timeAgo(c.last_seen_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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

              {/* MCP AI Provider Selector */}
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs dark:border-stone-700 dark:bg-stone-800">
                <div className="flex items-center gap-2 mb-3">
                  <Terminal className="h-4 w-4 text-[#445942] dark:text-[#7ba277]" />
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Connect an MCP Client
                  </h3>
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  {MCP_CLIENTS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClient(c.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selectedClient === c.id
                          ? "border-[#445942] bg-[#445942] text-white dark:border-[#7ba277] dark:bg-[#5b7858]"
                          : "border-stone-200 bg-white text-stone-600 hover:border-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-stone-600 dark:text-stone-300 mb-3 leading-relaxed">
                  Add this block to <strong>{activeClient.label}</strong>&apos;s config file, located at{" "}
                  <code className="rounded bg-stone-100 px-1 py-0.5 text-[11px] dark:bg-stone-900">
                    {activeClient.configFile(targetOs)}
                  </code>
                  {activeClient.instructions && <> &mdash; {activeClient.instructions}</>}
                  {targetOs === "windows" && (
                    <>
                      {" "}Note: on Windows, <code className="font-semibold text-emerald-700 dark:text-emerald-400">cmd.exe</code> and the <code className="font-semibold text-emerald-700 dark:text-emerald-400">cwd</code> parameter are required to resolve Node.js modules.
                    </>
                  )}
                </p>

                <div className="relative rounded-lg bg-stone-900 p-3 font-mono text-xs text-stone-100 dark:bg-stone-950">
                  <button
                    onClick={() => handleCopy(activeSnippet, selectedClient)}
                    className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded border border-stone-700 bg-stone-800 px-2.5 py-1 text-[11px] text-stone-200 hover:bg-stone-700"
                  >
                    {copiedText === selectedClient ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy {activeClient.format === "toml" ? "TOML" : "JSON"}</span>
                      </>
                    )}
                  </button>
                  <pre className="overflow-x-auto pr-24 leading-relaxed">{activeSnippet}</pre>
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
