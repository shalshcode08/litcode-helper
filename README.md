# Litcode Helper

Personal Chrome/Edge extension that logs accepted LeetCode solutions to a GitHub repository.

## Setup

```bash
pnpm install
pnpm run build
```

Then open Chrome Extensions, enable Developer Mode, choose **Load unpacked**, and select the `dist` folder.

## GitHub Requirements

Create the destination repo with a README so the default branch exists. In GitHub, create a fine-grained personal access token with:

- Repository access: only the destination repo
- Contents: read and write
- Metadata: read

Open the Litcode Helper settings page and enter the owner, repo, branch, token, timezone, and duplicate behavior.

## Behavior

When LeetCode shows an accepted submission, the extension captures the problem, editor code, problem link, difficulty, language, and statement. It writes files like:

```txt
2026-05-30/two-sum.js
```

If automatic capture misses a page change, use **Save current problem** from the popup while the LeetCode problem tab is active.
