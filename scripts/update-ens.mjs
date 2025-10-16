#!/usr/bin/env node
// Update an ENS name's contenthash to a given IPFS CID (EIP-1577)
// Requires: ETHEREUM_RPC_URL, ENS_PRIVATE_KEY, ENS_NAME, IPFS_CID

import { Contract, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes, getBytes, concat } from 'ethers'
import contentHash from 'content-hash'

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

  const provider = new JsonRpcProvider(ETHEREUM_RPC_URL)
  const signer = new Wallet(ENS_PRIVATE_KEY, provider)

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

  const current = await resolver.contenthash(node).catch(() => '0x')
  const encoded = contentHash.fromIpfs(IPFS_CID)

  if (current && current.toLowerCase() === encoded.toLowerCase()) {
    console.log(`No-op: ${ENS_NAME} already points to ${IPFS_CID}`)
    return
  }

  console.log(`Updating ${ENS_NAME} contenthash to IPFS CID ${IPFS_CID}…`)
  const tx = await resolver.setContenthash(node, encoded)
  console.log(`Submitted tx: ${tx.hash}`)
  const receipt = await tx.wait()
  console.log(`Confirmed in block ${receipt.blockNumber}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

