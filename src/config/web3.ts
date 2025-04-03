import { createWeb3Modal } from '@web3modal/wagmi/react';
import { createConfig, http } from 'wagmi';
import { baseSepolia, mainnet } from 'wagmi/chains';
import { QueryClient } from '@tanstack/react-query';

// 0. Setup queryClient - Export directly
export const queryClient = new QueryClient();

// 1. Get projectId from WalletConnect Cloud
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
// Get Alchemy API Key
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

if (!projectId) {
  throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set');
}
if (!alchemyApiKey) {
  throw new Error('NEXT_PUBLIC_ALCHEMY_API_KEY is not set');
}

// 2. Define constants for config
const chains = [baseSepolia, mainnet] as const;

// 3. Create Wagmi config using createConfig - Export directly
export const wagmiConfig = createConfig({
  chains: chains,
  transports: {
    // Use Alchemy API Key for Base Sepolia transport
    [baseSepolia.id]: http(`https://base-sepolia.g.alchemy.com/v2/${alchemyApiKey}`),
    [mainnet.id]: http() // Default transport for mainnet (or use another key)
  },
  ssr: true,
});

// 4. Create modal, passing the created wagmiConfig
// This needs to run side-effectfully when the module is imported.
if (typeof window !== 'undefined') { // Ensure this runs only client-side
  createWeb3Modal({
    wagmiConfig: wagmiConfig, // Pass the config created above
    projectId,
  });
}

// 5. Remove the Web3Provider component entirely
/*
export function Web3Provider({ children }: { children: React.ReactNode }) {
  // No need for useState if config is created outside
  // const [config] = useState(() => wagmiConfig);

  // if (!wagmiConfig) return null; // Config should always exist now

  return (
    // Pass the config created outside the component
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
} 
*/ 