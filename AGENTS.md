# Filecoin Pin + ENS Demo — AGENTS.md

This document is the living single source of truth for this demo repo. It defines goals, provides a concise TODO plan, and keeps a running notebook for decisions and context. Every time you (an agent or human) make changes, update this file so the next step can be resumed without any fidelity loss.

## Goals
- Simple static website committed to this repo (`site/`).
- GitHub Actions workflow to build and publish site output as an artifact.
- GitHub Actions workflow using Filecoin Pin Upload Action to pack site into a CAR, upload to Filecoin (Calibration by default), and surface the IPFS root CID.
- ENS integration: update the ENS name’s contenthash to the latest IPFS CID on push to `main`.
- Sensible security defaults (two‑workflow pattern, secrets isolated to trusted workflow). 

## Repo Layout
- `site/` — Static website source.
- `dist/` — Build output (artifact only; ignored in git).
- `scripts/update-ens.mjs` — Node script to set ENS `contenthash` to a new IPFS CID.
- `.github/workflows/build-site.yml` — Untrusted build (no secrets). Runs on PRs and pushes to `main`.
- `.github/workflows/upload-to-filecoin-and-update-ens.yml` — Trusted workflow. Downloads the build artifact, uploads to Filecoin, and updates ENS on push to `main`.

## Secrets & Config
- `secrets.FILECOIN_WALLET_KEY` — Private key for Filecoin Pay wallet (USDFC on Calibration/Mainnet) used by the upload action.
- `secrets.ETHEREUM_RPC_URL` — Ethereum JSON-RPC URL (e.g., mainnet or Sepolia). Used for ENS updates.
- `secrets.ENS_PRIVATE_KEY` — Private key with permission to update the ENS name resolver.
- `vars.ENS_NAME` (or `secrets.ENS_NAME`) — The ENS name to update (e.g., `example.eth`).
- Optional `vars.ENS_REGISTRY_ADDRESS` — ENS registry address; defaults to mainnet’s `0x00000000000C2E074eC69A0dFb2997Ba6C7d2e1e`.

Notes:
- Filecoin uploads default to the Calibration testnet; data there is not permanent and infra resets routinely.
- For PR events, the upload action runs in `dryRun` mode to avoid spending; ENS updates only occur on push to `main`.

## TODO (Execution Plan)
1) Confirm secrets and vars in repository settings
   - `FILECOIN_WALLET_KEY`, `ETHEREUM_RPC_URL`, `ENS_PRIVATE_KEY`, and `ENS_NAME` (variable or secret).
2) Build workflow sanity check
   - Open a PR; verify `Build Site` runs and publishes `site-dist` artifact.
3) Upload workflow sanity check (PR)
   - Verify `Upload to Filecoin + ENS` triggers via `workflow_run`, executes in `dryRun` for PR, and surfaces an IPFS root CID.
4) Main branch test
   - Merge to `main` (or push to `main`); verify upload actually occurs and outputs `ipfsRootCid`.
5) ENS update verification
   - On push to `main`, confirm `scripts/update-ens.mjs` updates `contenthash` for `${ENS_NAME}` to the new IPFS CID.
6) Observability polish
   - Consider adding PR comments or step summaries linking provider dashboard and gateways.
7) Optional: switch ENS or Filecoin networks
   - Move ENS to mainnet/Sepolia as desired; change Filecoin network from `calibration` to `mainnet` when ready.

## Notebook (Decisions, Rationale, Notes)
- Pattern: Adopted the two‑workflow pattern from `filecoin-pin/upload-action` docs to isolate secrets and keep limits hardcoded in a trusted file.
- PRs: The upload action runs with `dryRun: true` for PR events; avoids deposits and on‑chain interactions while still proving build determinism.
- ENS: Updates only on push to `main` to prevent PR traffic from mutating production DNS. `scripts/update-ens.mjs` uses ethers + content-hash to encode the EIP‑1577 `contenthash`.
- Action version: Using `filecoin-project/filecoin-pin/upload-action@v1` (semantic tag). For supply chain hardening, pin to a specific commit.
- Future work: Add preview links, gateway checks, environment‑gated approvals, and optional CDN once provider support and cost reporting are tightened.

## How to Contribute as an Agent
- Before changes: Read this file and the workflows under `.github/workflows/`.
- After changes: Update this AGENTS.md with:
  - What changed and why
  - Any new secrets/vars/paths
  - Next actionable step(s) so work can resume seamlessly

## References
- Filecoin Pin Upload Action docs: `filecoin-pin/upload-action/README.md`, `action.yml`, `examples/`
- ENS contenthash EIP‑1577 and namehash EIP‑137
- Public Resolver: `setContenthash(bytes32 node, bytes hash)`

