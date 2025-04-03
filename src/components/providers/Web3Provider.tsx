'use client'; // Mark this component as a Client Component

import React from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig, queryClient } from "@/config/web3";

export function Web3Provider({ children }: { children: React.ReactNode }) {
    // Render the providers within the client boundary
    return (
        <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    );
} 