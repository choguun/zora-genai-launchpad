import React from 'react';
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Define w3m-button as a valid intrinsic element
      'w3m-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      // Add other custom elements here if needed
    }
  }
}

// Add empty export to ensure file is treated as a module
export {}; 