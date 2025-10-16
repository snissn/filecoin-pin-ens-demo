#!/usr/bin/env node
// Update an ENS name's contenthash to a given IPFS CID (EIP-1577)
// Requires: ETHEREUM_RPC_URL, ENS_PRIVATE_KEY, ENS_NAME, IPFS_CID

import { Contract, JsonRpcProvider, FallbackProvider, Wallet, keccak256, toUtf8Bytes, getBytes, concat } from 'ethers'
import contentHash from 'content-hash'
import { CID } from 'multiformats/cid'

function requiredEnv(name) {
  const v = process.env[name]
  if (!v || v.trim() === '') throw new Error(`Missing required env: ${name}`)
  return v
}

function namehash(name) {
  // EIP-137 namehash implementation
  let node = '0x' + '00'.repeat(32)
  if (!name) return node
  const labels = name.toLowerCase().split('.')
  for (let i = labels.length - 1; i >= 0; i--) {
    const labelHash = keccak256(toUtf8Bytes(labels[i]))
    node = keccak256(concat([getBytes(node), getBytes(labelHash)]))
  }
  return node
}

async function main() {
  const ENS_NAME = requiredEnv('ENS_NAME')
  const IPFS_CID = requiredEnv('IPFS_CID')
  const ETHEREUM_RPC_URL = requiredEnv('ETHEREUM_RPC_URL')
  const ENS_PRIVATE_KEY = requiredEnv('ENS_PRIVATE_KEY')
  const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'

  // Build provider with optional fallbacks
  const urlsEnv = process.env.ETHEREUM_RPC_URLS || ETHEREUM_RPC_URL
  const rpcUrls = urlsEnv.split(',').map((s) => s.trim()).filter(Boolean)
  let provider
  if (rpcUrls.length > 1) {
    const providers = rpcUrls.map((u) => new JsonRpcProvider(u))
    provider = new FallbackProvider(providers.map((p) => ({ provider: p, weight: 1 })))
  } else {
    provider = new JsonRpcProvider(rpcUrls[0])
  }
  function normalizePrivateKey(pk) {
    const v = (pk || '').trim()
    const prefixed = v.startsWith('0x') ? v : `0x${v}`
    if (!/^0x[0-9a-fA-F]{64}$/.test(prefixed)) {
      throw new Error('ENS_PRIVATE_KEY must be a 0x-prefixed 64-hex-character string (no quotes or whitespace).')
    }
    return prefixed
  }

  const signer = new Wallet(normalizePrivateKey(ENS_PRIVATE_KEY), provider)

  const REGISTRY_ABI = [
    'function resolver(bytes32 node) view returns (address)'
  ]
  const RESOLVER_ABI = [
    'function contenthash(bytes32 node) view returns (bytes)',
    'function setContenthash(bytes32 node, bytes hash) external'
  ]

  const node = namehash(ENS_NAME)
  const registry = new Contract(ENS_REGISTRY_ADDRESS, REGISTRY_ABI, provider)
  const resolverAddr = await registry.resolver(node)
  if (!resolverAddr || resolverAddr === '0x0000000000000000000000000000000000000000') {
    throw new Error(`No resolver set for ${ENS_NAME}. Please set a resolver that supports contenthash.`)
  }

  const resolver = new Contract(resolverAddr, RESOLVER_ABI, signer)

  async function withRpcRetry(fn, label, max = 5) {
    let attempt = 0
    let lastErr
    while (attempt < max) {
      try {
        return await fn()
      } catch (err) {
        lastErr = err
        const msg = (err && (err.message || err.shortMessage)) || ''
        const body = err?.info?.responseBody || ''
        const status = err?.info?.responseStatus || ''
        const retryable = msg.includes('rate limit') || body.includes('rate limit') || status.includes('429') || status.includes('599')
        if (!retryable) throw err
        const backoff = Math.min(10000, 1000 * Math.pow(2, attempt)) // 1s,2s,4s,8s,10s
        console.warn(`RPC rate limited during ${label}. Retrying in ${backoff}ms (attempt ${attempt + 1}/${max})...`)
        await new Promise((r) => setTimeout(r, backoff))
        attempt++
      }
    }
    throw lastErr
  }

  const current = await withRpcRetry(() => resolver.contenthash(node), 'resolver.contenthash').catch(() => '0x')

  // content-hash library requires base58 (CIDv0) for ipfs-ns; convert when possible
  let cidForEns = IPFS_CID
  try {
    const parsed = CID.parse(IPFS_CID)
    if (parsed.version === 1) {
      try {
        cidForEns = parsed.toV0().toString()
      } catch {
        throw new Error('Provided CID is CIDv1 and cannot be converted to CIDv0 (required by content-hash). Ensure the CID is dag-pb with sha2-256, or provide a CIDv0 (Qm...).')
      }
    }
  } catch {
    // Not a CID, let content-hash try; will likely fail fast with a clear message
  }

  const encodedNo0x = contentHash.fromIpfs(cidForEns)
  const encoded = '0x' + encodedNo0x

  if (current && current.toLowerCase() === encoded.toLowerCase()) {
    console.log(`No-op: ${ENS_NAME} already points to ${IPFS_CID}`)
    return
  }

  console.log(`Updating ${ENS_NAME} contenthash to IPFS CID ${IPFS_CID}…`)
  console.log(`Original CID: ${IPFS_CID}`)
  if (cidForEns !== IPFS_CID) console.log(`Converted to CIDv0: ${cidForEns}`)
  console.log(`Encoded contenthash (hex, 0x-prefixed) length=${encoded.length}`)
  const encodedBytes = getBytes(encoded)
  console.log(`Encoded contenthash bytes length=${encodedBytes.length}`)
  const tx = await withRpcRetry(() => resolver.setContenthash(node, encodedBytes), 'resolver.setContenthash')
  console.log(`Submitted tx: ${tx.hash}`)
  const receipt = await tx.wait()
  console.log(`Confirmed in block ${receipt.blockNumber}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
