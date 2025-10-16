# Filecoin Pin + ENS Demo

A minimal demo showing a static website deployed with the Filecoin Pin Upload Action and an ENS update that points the ENS name to the latest IPFS CID after each push to `main`.

## What’s Included
- `site/` static content
- Two GitHub workflows:
  - `Build Site` (PRs + pushes to `main`)
  - `Upload to Filecoin + ENS` (runs after successful build)
- `scripts/update-ens.mjs` to update ENS `contenthash` via ethers + content-hash

## Setup
1. Add repository secrets/vars:
   - `FILECOIN_WALLET_KEY` (secret)
   - `ETHEREUM_RPC_URL` (secret)
   - `ENS_PRIVATE_KEY` (secret)
   - `ENS_NAME` (variable or secret)
   - Optional `ENS_REGISTRY_ADDRESS` (variable) if not using mainnet registry
2. Open a PR to see the build succeed (dry-run upload).
3. Merge to `main` to upload to Filecoin and update ENS.

See `AGENTS.md` for detailed goals, plan, and notes.

## Test on Holesky (ENS) + Calibration (Filecoin)

This repo is set up to let you test ENS updates on the Holesky Ethereum testnet while uploading site content to the Filecoin Calibration network.

### Prerequisites
- ENS on Holesky
  - You control an ENS name on Holesky: set `ENS_NAME` to that name.
  - You know the Holesky ENS registry address: set `ENS_REGISTRY_ADDRESS` to that address.
  - Your name has a resolver set that supports `setContenthash(bytes32,bytes)` (Public Resolver or equivalent on Holesky).
- Holesky account and RPC
  - `ETHEREUM_RPC_URL`: Holesky RPC endpoint
  - `ENS_PRIVATE_KEY`: private key controlling the ENS name; funded with Holesky ETH
- Filecoin Calibration
  - `FILECOIN_WALLET_KEY`: funded with USDFC to satisfy `minStorageDays` within `filecoinPayBalanceLimit`

Set these in repository Settings → Secrets and variables:
- Secrets: `FILECOIN_WALLET_KEY`, `ETHEREUM_RPC_URL`, `ENS_PRIVATE_KEY`
- Vars or Secrets: `ENS_NAME`
- Vars (optional but recommended on Holesky): `ENS_REGISTRY_ADDRESS`

### Step 1 — Create a PR to get an IPFS CID (dry-run)
Open a PR that changes something in `site/` (for example, edit `site/index.html`). CI will:
- Build the site and publish the `site-dist` artifact.
- Trigger the “Upload to Filecoin + ENS” workflow via `workflow_run`.
- Run the Filecoin upload in `dryRun: true` (because the originating event is `pull_request`).
- Compute and surface `ipfsRootCid` but skip the ENS update.

Where to find the CID on the PR run:
- In the job’s step logs for “Upload to Filecoin” (`ipfsRootCid: ...`).
- In the job summary appended by the action (if available).
- In the artifact `filecoin-pin-artifacts/context.json` (download from the run artifacts) under `ipfsRootCid`.

This avoids the chicken‑and‑egg problem: you don’t need a CID ahead of time—the PR run computes it without spending or updating ENS.

### Step 2 — Optional: Local ENS update sanity check using the PR’s CID
After the PR run, use the `ipfsRootCid` from Step 1 to verify your Holesky ENS setup locally:

```bash
cd filecoin-pin-ens-demo
npm install

# Use the ipfsRootCid from the PR run
ENS_NAME=yourname.holesky.eth \
IPFS_CID=<ipfsRootCid_from_PR> \
ETHEREUM_RPC_URL=https://holesky.example.org \
ENS_PRIVATE_KEY=0xabc... \
ENS_REGISTRY_ADDRESS=0xYourHoleskyRegistryAddress \
npm run update:ens
```

Expected:
- If the contenthash differs, a transaction is submitted and confirmed.
- If it matches, the script exits with a no-op message.
- If it errors with “No resolver set”, set a resolver for your name that supports `contenthash` and retry.

### Step 3 — Push to main (real upload + ENS update)
Merge the PR or push to `main`. CI will:
- Build the site and publish the artifact.
- Run the upload with `dryRun: false` (originating event is `push`).
- Upload to Filecoin Calibration and output the new `ipfsRootCid`.
- Run `scripts/update-ens.mjs` to set your Holesky ENS name’s `contenthash` to the new IPFS CID.

### Verify
- ENS: Re-run the local script with the same `IPFS_CID` to see a no-op, or read `contenthash` from your resolver directly with ethers.
- Filecoin: Use workflow logs and the action summary to confirm the `ipfsRootCid`; optional: view via any IPFS gateway.

### Troubleshooting
- Resolver not set or wrong resolver
  - Set a Holesky resolver for your name that implements `setContenthash`. Use your Holesky ENS UI or a script.
- Insufficient gas on Holesky
  - Fund the `ENS_PRIVATE_KEY` account with Holesky ETH.
- Filecoin payment limits
  - Ensure the wallet has sufficient USDFC on Calibration. For testing, consider reducing `minStorageDays` and/or increasing `filecoinPayBalanceLimit` (in the trusted workflow) within safe limits.
- Wrong registry
  - Holesky is not part of the official ENS mainnet deploys; set the exact Holesky registry address you used in `ENS_REGISTRY_ADDRESS`.

### Notes
- PRs are dry-run by design to avoid spend and DNS mutations.
- Pushes to `main` perform real uploads and ENS updates.
- Record your Holesky registry and resolver addresses in `AGENTS.md` to ensure future work can resume without context loss.

## Manual Runs in Forks

Forked repositories often don’t run workflows automatically until Actions are enabled. This repo includes manual triggers to let you run everything in a fork.

Prerequisites in your fork
- Enable Actions: Settings → Actions → General → Allow all actions and reusable workflows. In the Actions tab, approve the banner if shown.
- Ensure workflows exist on your default branch: `.github/workflows/build-site.yml` and `.github/workflows/upload-to-filecoin-and-update-ens.yml`.
- Add required secrets/vars in the fork: `FILECOIN_WALLET_KEY`, `ETHEREUM_RPC_URL`, `ENS_PRIVATE_KEY`, `ENS_NAME`, and (for Holesky) `ENS_REGISTRY_ADDRESS`.

Run manually
1) Build Site
   - Actions → “Build Site” → Run workflow (choose branch).
   - This creates the `site-dist` artifact.

2) Upload to Filecoin + ENS
   - Actions → “Upload to Filecoin + ENS” → Run workflow.
   - Inputs:
     - `build_run_id` (optional): ID of a prior Build Site run to pull the `site-dist` artifact from. Leave blank to build `site/` inline.
     - `dry_run` (boolean): default true; set false to perform a real upload to Calibration.
     - `update_ens` (boolean): default false; set true to update ENS after upload (requires ENS secrets/vars).

Finding a run ID (optional)
- Open the desired “Build Site” run and copy the Run ID from the page URL (or use the UI’s Run ID display). Paste it into `build_run_id` when manually running the upload workflow.

Notes
- Manual runs without `build_run_id` will copy `site/` to `dist/` inline. The secure pattern still uses the two‑workflow chain via `workflow_run` when not running manually.
- To test the default chain in a fork, open a PR from a branch in the same fork targeting its `main`. If it still doesn’t auto-run, use the manual triggers above.
