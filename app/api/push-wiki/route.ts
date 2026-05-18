import { NextRequest } from "next/server";
import { Octokit } from "@octokit/rest";

export async function POST(req: NextRequest) {
  const { repoUrl, token, wikiContent } = await req.json();

  if (!repoUrl?.trim() || !token?.trim() || !wikiContent?.trim()) {
    return Response.json({ error: "repoUrl, token, and wikiContent are required" }, { status: 400 });
  }

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return Response.json({ error: "Invalid GitHub URL" }, { status: 422 });

  const [, owner, repo] = match;
  const repoName = repo.replace(/\.git$/, "");
  const octokit = new Octokit({ auth: token });

  // Parse wiki pages from content (### PAGE: <title>\n<body>)
  const pages: { title: string; body: string }[] = [];
  const pageMatches = wikiContent.matchAll(/### PAGE: (.+)\n([\s\S]+?)(?=### PAGE:|$)/g);
  for (const m of pageMatches) {
    pages.push({ title: m[1].trim(), body: m[2].trim() });
  }

  if (pages.length === 0) {
    return Response.json({ error: "No wiki pages found in content" }, { status: 422 });
  }

  const results: string[] = [];

  for (const page of pages) {
    const slug = page.title === "Home" ? "Home" : page.title.replace(/\s+/g, "-");
    const wikiRepo = `${repoName}.wiki`;

    try {
      // Try to get existing file SHA
      let sha: string | undefined;
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo: wikiRepo,
          path: `${slug}.md`,
        });
        if (!Array.isArray(data) && data.type === "file") sha = data.sha;
      } catch {
        // File doesn't exist yet — create it
      }

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo: wikiRepo,
        path: `${slug}.md`,
        message: `docs: update ${slug} wiki page via ChangeScribe`,
        content: Buffer.from(page.body).toString("base64"),
        ...(sha ? { sha } : {}),
      });

      results.push(slug);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return Response.json({ error: `Failed to push ${slug}: ${msg}` }, { status: 500 });
    }
  }

  return Response.json({ pushed: results });
}
