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
  { id: 'zcash', name: 'Zcash Transparent', icon: 'zcash', assets: 'ZEC', address: 't1ffcdEs6WUZsK4iTpSg3fYM3STmZ8rfXjy' },
  { id: 'zcash-shielded', name: 'Zcash Shielded', icon: 'zcash', assets: 'ZEC', uriScheme: 'zcash', address: 'u1093sjwd5aleadm0j8jfzu0l7krkmv82yjrpk5j86j0vrkmy3eppkcv6e930qukvdy4p6nc8u0ttlwh6qu5gce84wht06xpzjzcqdwev0' },
  { id: 'tron', name: 'TRON', icon: 'tron', assets: 'TRX, USDT and other tokens', trustWalletAsset: 'c195', address: 'TLq3NiF3QkwzcFwhZhvVDUSQ3shzbDf6fQ' },
  { id: 'dogecoin', name: 'Dogecoin', icon: 'dogecoin', assets: 'DOGE', address: 'DLYUL5TuJPvQq71xFxdm337Ti5sZyP5BKk' },
  { id: 'monero', name: 'Monero', icon: 'monero', assets: 'XMR', address: '47XCwRMTyEvav4QMqeh8ChaLg4Ubt7ASSWvyW9BG8vB19wXUS4E7C1qWkFnyzFFoTcf8AAmrUDG11EE2B6GFgFAWArkriQd' },
];

// Native wallet handoffs; amounts remain donor-entered.
export function donationWalletUri(network) {
  if (network.trustWalletAsset) {
    return `trust://send?asset=${network.trustWalletAsset}&address=${network.address}`;
  }
  return network.chainId === undefined
    ? `${network.uriScheme ?? network.id}:${network.address}`
    : `ethereum:${network.address}@${network.chainId}`;
}
