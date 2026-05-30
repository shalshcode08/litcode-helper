# Litcode Helper

Litcode Helper is a Chrome extension that saves accepted LeetCode solutions to a GitHub repository.

It captures the problem link, statement, language, and submitted code, then stores each solution by date.

```txt
leetcode-helper/
└── 2026-05-30/
    ├── two-sum.js
    └── add-two-numbers.cpp
```

## Features

- Automatically logs accepted LeetCode submissions
- Saves solutions into daily GitHub folders
- Includes problem link, statement, metadata, and code
- Supports manual save and retry queue
- Uses the user's own GitHub repo and fine-grained token
- No backend, analytics, ads, or tracking

## Tech Stack

- Chrome Extension Manifest V3
- TypeScript
- React
- Vite
- Astro landing page
- pnpm

## Development

Install dependencies:

```bash
pnpm install
```

Run extension build in watch mode:

```bash
pnpm dev
```

Build extension:

```bash
pnpm run build
```

Package extension for Chrome Web Store:

```bash
pnpm run package
```

Build landing page:

```bash
pnpm run landing:build
```

## Local Extension Install

1. Run `pnpm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `dist/` folder

## User Setup

Create a GitHub repository named:

```txt
leetcode-helper
```

Enable **Add a README file** while creating the repo. This creates the `main` branch, which the extension needs before it can upload files.

Then create a fine-grained GitHub token:

1. Open `https://github.com/settings/personal-access-tokens/new`
2. Select only the `leetcode-helper` repository
3. Set **Contents** to **Read and write**
4. Leave **Metadata** as **Read-only**
5. Paste the token into Litcode Helper settings
6. Click **Test GitHub**

## Landing Page Deployment

The Astro landing page lives in `site/` and builds to `site-dist/`.

Recommended Vercel settings:

```txt
Framework Preset: Astro
Build Command: pnpm run landing:build
Output Directory: site-dist
Install Command: pnpm install
```

Production URL:

```txt
https://litcode-helper.vercel.app/
```

Privacy policy:

```txt
https://litcode-helper.vercel.app/privacy/
```

## Privacy

Litcode Helper stores settings and the GitHub token locally in the browser. It sends problem data and solution code only to GitHub's API for the repository configured by the user.

See [PRIVACY.md](./PRIVACY.md).
