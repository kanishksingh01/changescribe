#!/usr/bin/env node
// Self-contained changelog generator — no API keys, no external dependencies.
// Parses conventional commits from git log and writes a formatted CHANGELOG.md.

const { execSync } = require("child_process");
const fs = require("fs");

const COMMIT_COUNT = parseInt(process.env.COMMIT_COUNT ?? "50", 10);

// conventional commit prefix → changelog section
const TYPE_MAP = {
  feat:     "Added",
  feature:  "Added",
  add:      "Added",
  fix:      "Fixed",
  bugfix:   "Fixed",
  bug:      "Fixed",
  remove:   "Removed",
  revert:   "Removed",
  deprecate:"Removed",
  change:   "Changed",
  refactor: "Changed",
  perf:     "Changed",
  improve:  "Changed",
  update:   "Changed",
  docs:     "Changed",
  doc:      "Changed",
  style:    "Changed",
  test:     "Changed",
  chore:    "Changed",
  ci:       "Changed",
  build:    "Changed",
};

const SKIP_PATTERNS = [
  /^\[skip ci\]/i,
  /^chore: bump version/i,
  /^chore: release/i,
  /docs: update CHANGELOG/i,
  /update CHANGELOG\.md/i,
];

function parseCommits() {
  let raw;
  try {
    // format: sha|subject|date
    raw = execSync(
      `git log --pretty=format:"%H|%s|%as" -${COMMIT_COUNT}`,
      { encoding: "utf8" }
    ).trim();
  } catch {
    console.error("::error::Failed to read git log. Ensure the repo is checked out with history.");
    process.exit(1);
  }

  if (!raw) {
    console.log("No commits found — nothing to changelog.");
    process.exit(0);
  }

  const sections = { Added: [], Fixed: [], Changed: [], Removed: [] };

  for (const line of raw.split("\n")) {
    const [sha, subject, date] = line.split("|");
    if (!subject) continue;
    if (SKIP_PATTERNS.some((p) => p.test(subject))) continue;

    // match "type(scope): message" or "type: message"
    const match = subject.match(/^(\w+)(?:\([^)]+\))?!?:\s*(.+)/);
    let section = "Changed";
    let message = subject;

    if (match) {
      const type = match[1].toLowerCase();
      section = TYPE_MAP[type] ?? "Changed";
      message = match[2];
    }

    sections[section].push({ sha: sha.slice(0, 7), message, date });
  }

  return sections;
}

function buildChangelog(sections) {
  const today = new Date().toISOString().split("T")[0];
  const lines = [`## [Unreleased] — ${today}\n`];

  for (const [heading, entries] of Object.entries(sections)) {
    if (!entries.length) continue;
    lines.push(`### ${heading}\n`);
    for (const { sha, message } of entries) {
      lines.push(`- ${message} (\`${sha}\`)`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function writeChangelog(newEntry) {
  const header =
    "# Changelog\n\nAll notable changes to this project will be documented in this file.\n" +
    "Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).\n\n";

  let existing = "";
  if (fs.existsSync("CHANGELOG.md")) {
    existing = fs.readFileSync("CHANGELOG.md", "utf8");
    // strip the header so we don't duplicate it
    existing = existing.replace(/^# Changelog[\s\S]*?\n\n/, "");
  }

  fs.writeFileSync("CHANGELOG.md", header + newEntry + existing);
  console.log("Written CHANGELOG.md");
}

function gitCommit() {
  try {
    execSync('git config user.name "github-actions[bot]"');
    execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
    execSync("git add CHANGELOG.md");
    const diff = execSync("git diff --cached --stat", { encoding: "utf8" });
    if (!diff.trim()) {
      console.log("No changes to CHANGELOG.md — skipping commit.");
      return;
    }
    execSync('git commit -m "docs: update CHANGELOG.md [skip ci]"');
    execSync("git push");
    console.log("Committed and pushed CHANGELOG.md");
  } catch (e) {
    console.error(`::error::Git commit failed: ${e.message}`);
    process.exit(1);
  }
}

const sections = parseCommits();
const entry = buildChangelog(sections);

const total = Object.values(sections).reduce((n, a) => n + a.length, 0);
console.log(`Parsed ${total} commits → writing changelog…`);

writeChangelog(entry);

if (process.env.GIT_COMMIT === "true") {
  gitCommit();
}
