import Groq from "groq-sdk";
import { NextRequest } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are an expert technical writer and DevOps engineer for software projects.
Given a GitHub repository's context (commits, description, file structure, existing README), produce clean, structured documentation.

Output exactly four sections separated by these exact markers:

## CHANGELOG ##
(Keep a Changelog 1.0 format. Group into Added, Changed, Fixed, Removed. Use bullet points. Date entries where possible.)

## README ##
(A clean project README with: title, one-line description, Features, Installation, Usage, License sections. Use the existing README as a base if provided but improve it.)

## WIKI ##
(Two wiki pages separated by "### PAGE:" markers:
  ### PAGE: Home
  (Project overview, architecture, quick start)
  ### PAGE: API Reference
  (Key functions/endpoints/commands inferred from commits and file structure))

## ACTIONS ##
(A complete, production-ready GitHub Actions workflow file in valid YAML.
- Tailor it to the repo's actual language and tooling inferred from the file structure and commits.
- Include: correct trigger (push to main + pull_request), checkout, dependency install, lint, test, and build steps matching the detected stack.
- Add a final job or step called "changelog" that runs on push to main only:
    - uses: actions/checkout@v4 with fetch-depth: 50
    - uses: kanishks1ngh/changelog-wiki-gen@v1 with commit-count: '50' and commit-changelog: 'true'
  No API keys or secrets needed for the changelog step.
- Output only the raw YAML — no markdown fences, no explanation.)

Be concise and professional.`;

async function ghFetch(path: string) {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "ChangeScribe/1.0",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status} on /${path}`);
  return res.json();
}

async function buildRepoContext(owner: string, repo: string): Promise<string> {
  const parts: string[] = [];

  // Repo metadata
  const meta = await ghFetch(`repos/${owner}/${repo}`);
  parts.push(`Repository: ${meta.full_name}`);
  parts.push(`Description: ${meta.description ?? "none"}`);
  parts.push(`Language: ${meta.language ?? "unknown"}`);
  if (meta.topics?.length) parts.push(`Topics: ${meta.topics.join(", ")}`);
  parts.push(`Stars: ${meta.stargazers_count} | Forks: ${meta.forks_count}`);
  parts.push("");

  // Recent commits
  const commits = await ghFetch(`repos/${owner}/${repo}/commits?per_page=50`);
  parts.push("Recent commits:");
  for (const c of commits) {
    const sha = c.sha.slice(0, 7);
    const msg = c.commit.message.split("\n")[0];
    const date = c.commit.author.date.slice(0, 10);
    parts.push(`  ${date} ${sha} ${msg}`);
  }
  parts.push("");

  // Top-level file tree
  try {
    const tree = await ghFetch(`repos/${owner}/${repo}/git/trees/HEAD?recursive=false`);
    const files = tree.tree
      .filter((f: { type: string }) => f.type === "blob")
      .slice(0, 40)
      .map((f: { path: string }) => f.path);
    parts.push("File structure (top level):");
    parts.push(files.join("\n"));
    parts.push("");
  } catch {
    // tree fetch is best-effort
  }

  // Existing README (first 100 lines for context)
  try {
    const readmeRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`, {
      headers: { "User-Agent": "ChangeScribe/1.0" },
    });
    if (readmeRes.ok) {
      const readme = await readmeRes.text();
      const preview = readme.split("\n").slice(0, 100).join("\n");
      parts.push("Existing README (first 100 lines):");
      parts.push(preview);
    }
  } catch {
    // optional
  }

  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  const { mode, repoUrl, gitLog } = await req.json();

  let log = "";

  if (mode === "github") {
    if (!repoUrl?.trim()) {
      return Response.json({ error: "Repository URL is required" }, { status: 400 });
    }
    const match = repoUrl.trim().match(/github\.com\/([^/]+)\/([^/\s]+)/);
    if (!match) {
      return Response.json({ error: "Invalid GitHub URL" }, { status: 422 });
    }
    const [, owner, repo] = match;
    try {
      log = await buildRepoContext(owner, repo.replace(/\.git$/, ""));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch repo";
      return Response.json({ error: msg }, { status: 422 });
    }
  } else {
    if (!gitLog?.trim()) {
      return Response.json({ error: "Git log is required" }, { status: 400 });
    }
    log = gitLog.trim();
  }

  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Git log:\n${log}` },
    ],
    stream: true,
    max_tokens: 4000,
    temperature: 0.2,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content ?? "";
        if (token) controller.enqueue(encoder.encode(token));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
