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

