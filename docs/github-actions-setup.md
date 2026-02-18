# GitHub Actions and branch protection setup

This guide walks through configuring GitHub so that **tests must pass** and **you approve all merges** before any code is merged into `dev` or `main`.

---

## Branch strategy: feature → dev → main

Using a **dev** integration branch is a solid approach:

- **Feature branches** → collaborators open PRs into **dev** only. CI runs; you approve and merge (or you merge after your approval).
- **dev** → when you’re ready to release, **you** open a PR from **dev** into **main** (collaborators do not create PRs to **main**). CI runs; you merge. Deploy from **main**.

**Collaborators:** They may only open pull requests into **dev**, not into **main**. All pull requests (to **dev**) must be approved by you before merging. Branch protection is set so that only you can merge into both **dev** and **main**, and (optionally) only your review counts as the required approval via Code Owners.

---

## What’s already in the repo

- **`.github/workflows/ci.yml`** — Runs on every push and pull request to **dev**, **main**, and **master**. It:
  1. Checks out the code
  2. Sets up Node.js 20
  3. Installs root and dashboard dependencies
  4. Runs `npm run build`
  5. Runs `npm test`

- **No secrets or real APIs** — Tests use mocks only. The HA API and Google Calendar API are fully mocked (`fetch` and the `api` module), so CI does **not** need `VITE_HA_BASE_URL`, `VITE_HA_TOKEN`, or any Google credentials. Tests **never** connect to your Home Assistant instance or Google, and **cannot** control real devices.

### Test safety: no real devices

The test suite is designed so that **nothing in your home can be controlled by CI or by running tests locally**:

| What tests do | What tests do *not* do |
|---------------|-------------------------|
| Replace `fetch` with a mock (api tests) | Send HTTP requests to your HA URL |
| Replace the entire `api` module with mocks (component tests) | Use `VITE_HA_TOKEN` or any real token |
| Assert that `callService('light', 'turn_off', …)` was called with the right args | Actually call Home Assistant services |
| Assert that `createCalendarEvent(payload)` was called | Hit Google Calendar API |

So GitHub Actions can run the full test suite **without any secret keys**, and your lights, locks, thermostats, and calendars are never touched by the tests.

---

## Step 1: Push the workflow and trigger a run

1. Commit and push your branch (the one with `.github/workflows/ci.yml` and the new `test` scripts):
   ```bash
   git add .github/workflows/ci.yml package.json dashboard/package.json docs/github-actions-setup.md
   git commit -m "Add CI workflow and placeholder test script"
   git push origin <your-branch-name>
   ```

2. Open your repo on GitHub and go to the **Actions** tab.

3. You should see a run for the push (or for the PR if you opened one). Click it and confirm the **Build and test** job completes successfully (green).

4. The workflow is configured for **dev**, **main**, and **master**. If you use different branch names, edit the `branches` list in `.github/workflows/ci.yml` under `on.push` and `on.pull_request`, then push again.

---

## Step 2: Require CI and your approval (branch protection)

Protect **dev** and **main** so that (1) tests must pass, (2) you must approve every PR, and (3) only you can merge. Create **two** branch protection rules (one for **dev**, one for **main**). GitHub does not let you “block collaborators from opening PRs to main,” so enforce that by **policy**: only you open PRs from dev → main; only you can merge into either branch.

### Optional: Require your review via Code Owners

So that only your approval counts as the required review (not a collaborator’s), add a Code Owners file:

1. Create **`.github/CODEOWNERS`** in the repo with one line (use your GitHub username):
   ```
   * @your-github-username
   ```
2. Commit and push. Then in each branch rule (below), when you enable “Require a pull request before merging,” expand it and turn on **Require review from Code Owners**. That way the “required approval” must come from you.

### Branch protection rule for **dev**

1. On GitHub: **Settings** → **Branches** → **Add branch protection rule**.
2. **Branch name pattern:** `dev`.
3. Enable:
   - **Require a pull request before merging**
     - Set **Required approvals** to **1**.
     - If you added CODEOWNERS, enable **Require review from Code Owners**.
   - **Require status checks to pass before merging** — select **Build and test**.
   - Optionally **Require branches to be up to date before merging**.
   - **Restrict who can push to matching branches** — add only **yourself** (so only you can merge; collaborators cannot merge even after approval).
4. Click **Create**.

### Branch protection rule for **main**

1. **Add** another branch protection rule.
2. **Branch name pattern:** `main` (or `master` if that’s your deploy branch).
3. Enable the **same** options as for **dev**:
   - **Require a pull request before merging** — 1 approval; **Require review from Code Owners** if you use CODEOWNERS.
   - **Require status checks** — **Build and test**.
   - **Restrict who can push to matching branches** — only **you** (so only you can merge; collaborators cannot open a PR to main and merge it themselves—and by policy they only open PRs to **dev**).
4. Click **Create**.

Result: Collaborators open PRs to **dev**; you approve and merge. Only you create and merge the **dev** → **main** PR when releasing.

---

## Step 3: Confirm behavior

1. Have a **collaborator** (or use a second account) open a **pull request** from a feature branch into **dev**. CI runs; the merge button stays disabled until **Build and test** passes and **you** have approved. Only you should be able to merge.

2. **You** open a **pull request** from **dev** into **main**. CI runs; you approve (if required) and merge. Collaborators should not open PRs to **main**.

3. Deploy from **main** when ready.

---

## Summary

| What | Where |
|------|--------|
| Workflow file | `.github/workflows/ci.yml` |
| Runs on | Push and PR to **dev**, **main**, and **master** |
| Job name (for branch protection) | **Build and test** |
| Branch flow | Feature → PR to **dev** (CI + your approval; only you merge) → **You** open PR **dev** → **main** (CI + you merge) → deploy from **main** |
| Collaborators | Open PRs to **dev** only; do not open PRs to **main**. All PRs require your approval; only you can merge. |
| Optional | `.github/CODEOWNERS` with `* @your-username` so only your review counts as the required approval. |
| Placeholder test | `dashboard/package.json` → `"test": "echo 'No tests yet'"` (replace when adding real tests) |

With both **dev** and **main** protected, every merge requires the **Build and test** run to pass and (with the settings above) your approval and only you can merge. Once you add real unit tests, the same workflow will run them automatically.
