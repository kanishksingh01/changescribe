"use client";

import { useState, useRef } from "react";
import { Tabs } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Check, Copy, Download, Settings } from "lucide-react";

type OutputSection = { changelog: string; readme: string; wiki: string; actions: string };
type InputMode = "github" | "paste";

function parseOutput(raw: string): OutputSection {
  const changelog = raw.match(/## CHANGELOG ##\n([\s\S]*?)(?=## README ##|$)/)?.[1]?.trim() ?? "";
  const readme = raw.match(/## README ##\n([\s\S]*?)(?=## WIKI ##|$)/)?.[1]?.trim() ?? "";
  const wiki = raw.match(/## WIKI ##\n([\s\S]*?)(?=## ACTIONS ##|$)/)?.[1]?.trim() ?? "";
  const actions = raw.match(/## ACTIONS ##\n([\s\S]*?)$/)?.[1]?.trim() ?? "";
  return { changelog, readme, wiki, actions };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background text-xs font-mono text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all cursor-pointer"
    >
      {copied ? (
        <>
          <Check size={12} className="text-primary" />
          <span className="text-primary">Copied</span>
        </>
      ) : (
        <>
          <Copy size={12} />
          Copy
        </>
      )}
    </button>
  );
}

function DownloadButton({ text, filename }: { text: string; filename: string }) {
  function download() {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background text-xs font-mono text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all cursor-pointer"
    >
      <Download size={12} />
      Download
    </button>
  );
}

const FILENAMES = {
  changelog: "CHANGELOG.md",
  readme: "README.md",
  wiki: "WIKI.md",
  actions: ".github/workflows/ci.yml",
} as const;

const EXAMPLE_REPOS = [
  "https://github.com/vercel/next.js",
  "https://github.com/facebook/react",
  "https://github.com/tailwindlabs/tailwindcss",
];

export function DocsGenerator() {
  const [inputMode, setInputMode] = useState<InputMode>("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [gitLog, setGitLog] = useState("");
  const [rawOutput, setRawOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputTab, setOutputTab] = useState("changelog");
  const abortRef = useRef<AbortController | null>(null);

  const output = parseOutput(rawOutput);
  const hasOutput = rawOutput.includes("## CHANGELOG ##");
  const canGenerate = inputMode === "github" ? repoUrl.trim().length > 0 : gitLog.trim().length > 0;

  async function generate() {
    if (isGenerating || !canGenerate) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setRawOutput("");
    setError(null);
    setIsGenerating(true);

    try {
      const body = inputMode === "github" ? { mode: "github", repoUrl } : { mode: "paste", gitLog };

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Generation failed");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setRawOutput((prev) => prev + decoder.decode(value));
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") setError(e.message);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-168px)] min-h-[640px]">
      {/* Input panel */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-base font-semibold flex items-center gap-2">
            <span className="text-primary">$</span> Repository
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 flex-1">
          {/* Mode toggle — pill style */}
          <div
            className="flex gap-0 rounded-full w-fit overflow-hidden border border-border"
            style={{ background: "#1E293B" }}
          >
            {(["github", "paste"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setInputMode(m)}
                className={`px-4 py-1.5 text-xs font-mono font-medium transition-all cursor-pointer relative ${
                  inputMode === m
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {inputMode === m && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                  />
                )}
                {m === "github" ? "GitHub URL" : "Paste log"}
              </button>
            ))}
          </div>

          {inputMode === "github" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Public GitHub repo URL
                </label>
                {/* Terminal command-line style input */}
                <div
                  className="flex items-center h-9 rounded-md border border-input font-mono text-sm overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all"
                  style={{ background: "#0a0f1a" }}
                >
                  <span className="px-3 text-primary select-none shrink-0">$</span>
                  <input
                    type="text"
                    placeholder="https://github.com/owner/repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && generate()}
                    disabled={isGenerating}
                    className="flex-1 h-full bg-transparent pr-3 py-1 text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Try an example</p>
                <div className="flex flex-col gap-1">
                  {EXAMPLE_REPOS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRepoUrl(r)}
                      className="text-left text-xs font-mono text-muted-foreground hover:text-primary px-2 py-1.5 rounded hover:bg-muted/60 transition-colors cursor-pointer"
                    >
                      <span className="text-primary/50 mr-1">›</span>{r.replace("https://github.com/", "")}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                Fetches commits, repo metadata, file structure, and existing README from GitHub&apos;s public API.
                No token required.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                Git log output
              </label>
              <code
                className="text-xs rounded-md px-3 py-2 font-mono text-primary select-all"
                style={{ background: "#0a0f1a" }}
              >
                git log --oneline -50
              </code>
              <Textarea
                placeholder={`a1b2c3d feat: add user authentication\nb4c5d6e fix: resolve race condition\nc7d8e9f docs: update API reference`}
                value={gitLog}
                onChange={(e) => setGitLog(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.metaKey && generate()}
                disabled={isGenerating}
                className="flex-1 min-h-[200px] font-mono text-sm resize-none placeholder:text-muted-foreground/40"
              />
            </div>
          )}

          {/* Generate button — green with glow */}
          <button
            onClick={generate}
            disabled={isGenerating || !canGenerate}
            className="w-full h-10 rounded-lg font-mono font-semibold text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "#22C55E",
              color: "#0F172A",
            }}
            onMouseEnter={(e) => {
              if (!isGenerating && canGenerate) {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 12px rgba(34,197,94,0.3)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-background/60 border-t-background animate-spin" />
                {inputMode === "github" ? "Parsing repo…" : "Generating…"}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="opacity-70">$</span> Generate Docs
              </span>
            )}
          </button>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 border border-destructive/20">
              {error}
            </p>
          )}

          {/* GitHub Action callout — terminal block style */}
          <div
            className="mt-auto rounded-lg border border-border p-4"
            style={{ background: "#0a0f1a" }}
          >
            <p className="text-xs font-mono font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <Settings size={12} className="text-primary" />
              <span className="text-primary">$</span> GitHub Action
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add{" "}
              <code
                className="px-1 rounded text-[11px] text-primary"
                style={{ background: "#1E293B" }}
              >
                examples/changelog.yml
              </code>{" "}
              to{" "}
              <code
                className="px-1 rounded text-[11px] text-primary"
                style={{ background: "#1E293B" }}
              >
                .github/workflows/
              </code>{" "}
              to auto-run on every push.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Output panel */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-base font-semibold flex items-center gap-2">
            <span className="text-primary">#</span> Generated files
            {isGenerating && <span className="text-xs text-primary font-mono animate-pulse">writing…</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 min-h-0">
          {!hasOutput && !isGenerating && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-xl border border-primary/20 flex items-center justify-center" style={{ background: "rgba(34,197,94,0.08)" }}>
                <FileText size={22} className="text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Paste a GitHub URL and hit Generate</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Download CHANGELOG.md, README.md, and wiki pages ready for your repo
                </p>
              </div>
            </div>
          )}

          {(hasOutput || isGenerating) && (
            <Tabs value={outputTab} onValueChange={setOutputTab} className="flex flex-col flex-1 min-h-0">
              {/* Tab list — active tab gets green text + underline, not filled background */}
              <div className="flex border-b border-border shrink-0">
                {(["changelog", "readme", "wiki", "actions"] as const).map((section) => (
                  <button
                    key={section}
                    onClick={() => setOutputTab(section)}
                    className={`px-3 py-2 text-xs font-mono font-medium relative transition-all cursor-pointer ${
                      outputTab === section
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {section.toUpperCase()}
                    {outputTab === section && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                  </button>
                ))}
              </div>

              {(["changelog", "readme", "wiki", "actions"] as const).map((section) => {
                const text = output[section];
                const filename = FILENAMES[section];
                if (outputTab !== section) return null;
                return (
                  <div key={section} className="flex-1 flex flex-col min-h-0 mt-3">
                    <div className="flex justify-between items-center mb-2 shrink-0">
                      <Badge variant="secondary" className="font-mono text-xs">{filename}</Badge>
                      {text && (
                        <div className="flex gap-2">
                          <CopyButton text={text} />
                          <DownloadButton text={text} filename={filename.split("/").pop()!} />
                        </div>
                      )}
                    </div>
                    {section === "actions" && text && (
                      <p className="text-xs text-muted-foreground font-mono mb-2">
                        Drop into{" "}
                        <code
                          className="px-1 rounded text-primary"
                          style={{ background: "#1E293B" }}
                        >
                          .github/workflows/
                        </code>{" "}
                        in your repo, add{" "}
                        <code
                          className="px-1 rounded text-primary"
                          style={{ background: "#1E293B" }}
                        >
                          GROQ_API_KEY
                        </code>{" "}
                        as a repo secret, and push.
                      </p>
                    )}
                    {/* Terminal output panel */}
                    <div
                      className="flex-1 overflow-auto rounded-lg border border-border flex flex-col"
                      style={{ background: "#0a0f1a" }}
                    >
                      {/* Terminal dots */}
                      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border shrink-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                        <span className="ml-2 text-xs font-mono text-muted-foreground">{filename}</span>
                      </div>
                      <pre
                        className="flex-1 p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed"
                        style={{
                          color: "#22C55E",
                          textShadow: "0 0 8px rgba(34,197,94,0.4)",
                        }}
                      >
                        {text || (isGenerating ? "" : "—")}
                        {isGenerating && (
                          <span className="inline-block w-2 h-4 bg-primary animate-pulse align-middle rounded-sm" />
                        )}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
