import React from 'react';

// Define a basic ExternalProvider type for window.ethereum
interface ExternalProvider {
    isMetaMask?: boolean;
    isStatus?: boolean;
    host?: string;
    path?: string;
    sendAsync?: (
        request: { method: string; params?: Array<unknown> },
        callback: (error: unknown, response: unknown) => void
    ) => void;
    send?: (
        request: { method: string; params?: Array<unknown> },
        callback: (error: unknown, response: unknown) => void
    ) => void;
    request?: (request: { method: string; params?: Array<unknown> }) => Promise<unknown>;
}

// Add Ethereum provider type to the window object
interface Window {
    ethereum?: ExternalProvider;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'w3m-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      // Add other custom elements here if needed
    }
  }
} 