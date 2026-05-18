import { DocsGenerator } from "@/components/DocsGenerator";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Terminal prompt branding */}
          <div className="flex items-center gap-0 font-mono text-sm">
            <span className="text-muted-foreground">~/changescribe</span>
            <span className="text-primary ml-2">$</span>
            <span className="ml-2 text-foreground font-semibold tracking-tight">_</span>
          </div>

          {/* Model + week status */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="w-2 h-2 rounded-full bg-primary" style={{ boxShadow: "0 0 6px rgba(34,197,94,0.6)" }} />
            <span className="text-foreground">llama-3.3-70b</span>
            <span className="text-muted-foreground">·</span>
            <span>Week 7/10</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <DocsGenerator />
      </main>

      <footer className="border-t border-border px-6 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>Powered by Groq · llama-3.3-70b-versatile</span>
          <a
            href="https://github.com/kanishks1ngh/changelog-wiki-gen"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors cursor-pointer"
          >
            GitHub →
          </a>
        </div>
      </footer>
    </div>
  );
}
