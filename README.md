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

### Step 1 — Local ENS update sanity check
Run the script locally to confirm your Holesky ENS setup (resolver and permissions) before relying on CI:

```bash
cd filecoin-pin-ens-demo
npm install

# Provide a test CID and your Holesky settings
ENS_NAME=yourname.holesky.eth \
IPFS_CID=bafybeigdyrzt4... \
ETHEREUM_RPC_URL=https://holesky.example.org \
ENS_PRIVATE_KEY=0xabc... \
ENS_REGISTRY_ADDRESS=0xYourHoleskyRegistryAddress \
npm run update:ens
```

Expected:
- If the contenthash differs, a transaction is submitted and confirmed.
- If it matches, the script exits with a no-op message.
- If it errors with “No resolver set”, set a resolver for your name that supports `contenthash`.

### Step 2 — PR dry‑run (no spend, no ENS change)
Open a PR that changes something in `site/` (for example, edit `site/index.html`). CI will:
- Build site and publish the `site-dist` artifact.
- Trigger the “Upload to Filecoin + ENS” workflow via `workflow_run`.
- Run the Filecoin upload in `dryRun: true` (because the originating event is `pull_request`).
- Produce an `ipfsRootCid` output but skip the ENS update.

### Step 3 — Push to main (real upload + ENS update)
Merge the PR or push to `main`. CI will:
- Build the site and publish the artifact.
- Run the upload with `dryRun: false` (originating event is `push`).
- Upload to Filecoin Calibration and output `ipfsRootCid`.
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
