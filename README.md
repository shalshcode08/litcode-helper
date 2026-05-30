# Litcode Helper

Litcode Helper is a personal Chrome/Edge extension that saves accepted LeetCode solutions into your GitHub repo.

It creates files like:

```txt
2026-05-30/add-two-numbers.cpp
2026-05-30/two-sum.js
```

Each file contains the problem link, statement, metadata, and your submitted code.

## Install Locally

```bash
pnpm install
pnpm run build
```

Then load the extension:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `dist` folder from this project.

During development, use:

```bash
pnpm dev
```

Reload the extension from `chrome://extensions` after rebuilds.

## Package For Chrome Web Store

```bash
pnpm run package
```

This creates:

```txt
litcode-helper.zip
```

Upload that ZIP in the Chrome Web Store Developer Dashboard.

## GitHub Setup

Use this repo name for the solution log:

```txt
leetcode-helper
```

Setup order:

1. Create a new GitHub repo named `leetcode-helper`.
2. While creating it, check **Add a README file**. This step is required.
3. After the repo exists, create the fine-grained token.

The README matters because it creates the `main` branch. Litcode Helper needs that branch before it can write solution files. If you skip the README, uploads can fail with a branch error.

Create the token after the repo exists:

1. Open GitHub fine-grained tokens: `https://github.com/settings/personal-access-tokens/new`
2. Set **Repository access** to **Only select repositories**.
3. Select the `leetcode-helper` repo.
4. Under **Repository permissions**, set **Contents** to **Read and write**.
5. Leave **Metadata** as **Read-only**.
6. Generate the token and paste it into Litcode Helper settings.

In Litcode Helper settings, fill:

```txt
Owner: your-github-username
Repository: leetcode-helper
Branch: main
Timezone: Asia/Kolkata
Token: github_pat_...
```

Click **Test GitHub**. Do not solve problems until this passes.

## Usage

Normal flow:

1. Open a LeetCode problem.
2. Solve and submit it.
3. When LeetCode shows **Accepted**, Litcode Helper tries to upload automatically.

Manual fallback:

1. Keep the LeetCode problem tab active.
2. Open the Litcode Helper popup.
3. Click **Check page**.
4. Click **Save current problem**.

## Troubleshooting

`GitHub 403: Resource not accessible by personal access token`

Your token can not write to the repo. Create a new fine-grained token and make sure:

```txt
Repository access: only your solutions repo
Contents: Read and write
Metadata: Read-only
```

`Branch "main" does not exist`

Your repo is empty. Add a `README.md` in GitHub first, then retry.

`Could not read the LeetCode editor content`

Refresh the LeetCode tab, then use **Check page** and **Save current problem** again.

Queued uploads stay in the extension. After fixing GitHub settings, click **Retry queue**.

## Chrome Web Store Notes

Use [PRIVACY.md](./PRIVACY.md) as the source for the extension privacy policy. Host it publicly before submitting the Chrome Web Store listing.

Permission explanations:

- `storage`: stores settings, GitHub token, upload status, retry queue, and duplicate tracking locally.
- `tabs`: checks the active LeetCode tab when the user manually saves a problem.
- `scripting`: injects the content script into an already-open LeetCode tab for manual save.
- `https://leetcode.com/*`: reads the active problem, statement, editor code, and accepted status.
- `https://api.github.com/*`: writes solution files to the user's configured GitHub repo.
