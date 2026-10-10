// Public receiving addresses only. Network support is explicitly maintained by the wallet owner.
const evmAddress = '0x0D4aAc6d3C5DF6D162F121992eBD441728B143a2';

export const donationNetworks = [
  { id: 'bitcoin', name: 'Bitcoin', icon: 'bitcoin', assets: 'BTC', address: 'bc1qesd92qv7h3mlh4qqs4grz3e32phvxj6spwkcyz' },
  { id: 'ethereum', name: 'Ethereum Mainnet', icon: 'ethereum', assets: 'ETH, USDC, USDT and other tokens', chainId: 1, address: evmAddress },
  { id: 'solana', name: 'Solana', icon: 'solana', assets: 'SOL, USDC, USDT and other tokens', address: '7oLWWpSrEG6aDKVZDAyuAjF3kDKEgAmnG3Q7JAb9uUXy' },
  { id: 'base', name: 'Base', icon: 'base', assets: 'ETH, USDC, USDT and other tokens', chainId: 8453, address: evmAddress },
  { id: 'arbitrum', name: 'Arbitrum One', icon: 'arbitrum', assets: 'ETH, USDC, USDT and other tokens', chainId: 42161, address: evmAddress },
  { id: 'optimism', name: 'Optimism', icon: 'optimism', assets: 'ETH, USDC, USDT and other tokens', chainId: 10, address: evmAddress },
  { id: 'polygon', name: 'Polygon PoS', icon: 'polygon', assets: 'POL, USDC, USDT and other tokens', chainId: 137, address: evmAddress },
  { id: 'bnb', name: 'BNB Smart Chain', icon: 'bnb', assets: 'BNB, USDC, USDT and other tokens', chainId: 56, address: evmAddress },
];

// Standard wallet payment URIs; amounts remain donor-entered.
export function donationWalletUri(network) {
  return network.chainId === undefined
    ? `${network.id}:${network.address}`
    : `ethereum:${network.address}@${network.chainId}`;
}
