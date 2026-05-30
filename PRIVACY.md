# Litcode Helper Privacy Policy

Litcode Helper is a browser extension that saves accepted LeetCode solutions to the GitHub repository configured by the user.

## Data Stored Locally

Litcode Helper stores the following data in the user's browser using extension storage:

- GitHub owner, repository, branch, timezone, and duplicate handling preference
- Fine-grained GitHub token provided by the user
- Upload status, retry queue, and duplicate tracking data

## Data Sent To GitHub

When a solution is saved, Litcode Helper sends the following data to `https://api.github.com`:

- Problem title
- Problem URL
- Problem statement
- Difficulty and language
- Submitted solution code
- File path based on the solve date

This data is sent only to the GitHub repository configured by the user.

## Data Collection

Litcode Helper does not use analytics, advertising, tracking pixels, telemetry, or a backend server.

Litcode Helper does not sell, share, or transfer user data to third parties.

## GitHub Token

The GitHub token is stored locally in the user's browser and is used only to call the GitHub API for the configured repository. Users should create a fine-grained token with access only to the repository used for Litcode Helper.

## Contact

For support or privacy questions, contact the extension publisher through the Chrome Web Store listing or the project repository.
