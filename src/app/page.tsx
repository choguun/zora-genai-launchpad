'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from "@/components/ui/label";

// Wagmi / Web3Modal / Zora Imports
import { useAccount, useWriteContract, useSwitchChain, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { createCreatorClient } from '@zoralabs/protocol-sdk';
import { parseAbiItem, decodeEventLog } from 'viem'; // For decoding logs

export default function Home() {
  // --- State --- 
  // Generation State
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false); // Renamed for clarity
  const [generationError, setGenerationError] = useState<string | null>(null); // Renamed

  // Coin Metadata State
  const [title, setTitle] = useState(''); // Includes '$'
  const [caption, setCaption] = useState('');

  // Minting State
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [newContractAddress, setNewContractAddress] = useState<string | null>(null); // Store created contract address

  // --- Wagmi Hooks --- 
  const { address: connectedAddress, chainId: connectedChainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient(); // Get public client for SDK
  const { data: writeContractHash, writeContract, isPending: isWriteContractLoading, error: writeContractError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt, error: confirmationError } = useWaitForTransactionReceipt({ 
    hash: writeContractHash,
  });

  // --- Effects --- 
  // Update minting state based on transaction status
  useEffect(() => {
    if (isWriteContractLoading || isConfirming) {
      setIsMinting(true);
      setMintError(null);
      setMintTxHash(writeContractHash ?? null);
    } else {
      setIsMinting(false);
    }
  }, [isWriteContractLoading, isConfirming, writeContractHash]);

  // Handle transaction success/error
  useEffect(() => {
    if (isConfirmed && receipt) {
      console.log('Mint transaction confirmed:', receipt);
      setMintTxHash(receipt.transactionHash);
      
      const setupNewContractEventAbi = [
        parseAbiItem('event SetupNewContract(address indexed newContract, address indexed creator, address indexed defaultAdmin, bytes setupActions)')
      ];
      
      // Try to find the log based on the number of indexed topics (3 for this event)
      // This is less specific than using the signature hash but often sufficient
      const setupLog = receipt.logs.find(log => log.topics.length === 4); // 1 (signature) + 3 indexed args = 4 topics

      if (setupLog) {
        try {
            const decodedLog = decodeEventLog({
                abi: setupNewContractEventAbi,
                data: setupLog.data,
                topics: setupLog.topics
            });
            // Ensure args exist and newContract is present
            if (decodedLog.args && 'newContract' in decodedLog.args) {
                const contractAddr = decodedLog.args.newContract;
                console.log("Decoded new contract address:", contractAddr);
                setNewContractAddress(contractAddr);
            } else {
                console.error("Decoded log does not contain newContract argument.");
            }
        } catch (decodeError) {
            console.error("Failed to decode SetupNewContract log:", decodeError);
        }
      } else {
        console.log("SetupNewContract log not found in transaction receipt.");
      }
      
      setMintError(null);
    } else if (writeContractError) {
      console.error('Mint writeContract error:', writeContractError);
      setMintError(writeContractError.message || 'Failed to send transaction.');
      setMintTxHash(null);
    } else if (confirmationError) {
      console.error('Mint confirmation error:', confirmationError);
      setMintError(confirmationError.message || 'Transaction confirmation failed.');
      setMintTxHash(writeContractHash ?? null); // Keep hash even if confirmation fails
    }
  }, [isConfirmed, receipt, writeContractError, confirmationError, writeContractHash]);

  // --- Handlers --- 
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setImageUrl(null); 
    setTitle(''); 
    setCaption(''); 
    setMintTxHash(null); 
    setMintError(null);
    setNewContractAddress(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) {
        let errorData; 
        try { 
          errorData = await response.json(); 
        } catch (parseErr) { 
          console.error("Failed to parse error response body:", parseErr);
        }
        throw new Error(errorData?.error || response.statusText || 'Failed to generate image');
      }
      const data = await response.json();
      setImageUrl(data.imageUrl || null);
    } catch (err: unknown) {
      console.error('Generation error:', err);
      setGenerationError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
    setIsGenerating(false);
  };

  const handleMint = async () => {
    if (!connectedAddress || !imageUrl || !title || !caption || !publicClient) return;

    // 1. Check Chain
    if (connectedChainId !== baseSepolia.id) {
      try {
        await switchChain({ chainId: baseSepolia.id });
        // Re-check after switch attempt (or rely on component re-render)
        if (window.ethereum && (await window.ethereum.request({ method: 'eth_chainId' })) !== baseSepolia.id.toString(16)) {
            setMintError(`Please switch your wallet to ${baseSepolia.name}.`);
            return;
        }
      } catch (switchError) {
        console.error("Failed to switch chain:", switchError);
        setMintError(`Failed to switch network. Please switch to ${baseSepolia.name} manually.`);
        return;
      }
    }

    setIsMinting(true);
    setMintError(null);
    setMintTxHash(null);
    setNewContractAddress(null);

    try {
      // 2. Prepare Metadata URI (minimal)
      const metadataJson = { name: title, description: caption };
      const metadataJsonString = JSON.stringify(metadataJson);
      const metadataDataUri = `data:application/json;base64,${Buffer.from(metadataJsonString).toString("base64")}`;

      // 3. Instantiate Zora Creator Client (client-side)
      const creatorClient = createCreatorClient({ chainId: baseSepolia.id, publicClient });

      // 4. Prepare parameters using SDK
      console.log("Preparing create1155 transaction via Zora SDK (Client-side)...");
      const { parameters } = await creatorClient.create1155({
        contract: { name: title, uri: metadataDataUri },
        token: { tokenMetadataURI: metadataDataUri },
        account: connectedAddress, // Use connected user address
        // Note: fundsRecipient defaults to the account if not specified in salesConfig
      });
      console.log("SDK prepared parameters:", parameters);

      // 5. Call writeContract hook
      console.log("Initiating transaction via writeContract...");
      writeContract(parameters);

    } catch (err: unknown) {
      console.error("Error preparing or initiating mint transaction:", err);
      setMintError(err instanceof Error ? err.message : 'An unexpected error occurred during mint preparation.');
      setIsMinting(false); // Ensure loading state stops if prep fails
    }
    // Loading state is now handled by useEffect based on writeContractHash/isConfirming
  };

  // --- Render --- 
  return (
    <main className="flex min-h-screen flex-col items-center p-6 sm:p-24">
      <header className="w-full max-w-md mb-8 flex justify-between items-center gap-4">
        <h1 className="text-xl sm:text-2xl font-bold">AI Coin Generator</h1>
        <w3m-button />
      </header>

      <div className="w-full max-w-md space-y-6">
        {/* Generation Card */}
        <Card>
          <CardHeader><CardTitle>1. Generate Image</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Enter your image prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating || isMinting}
            />
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || isMinting || !prompt}
              className="w-full"
            >
              {isGenerating ? 'Generating...' : 'Generate Image'}
            </Button>
          </CardContent>
        </Card>

        {/* Loading Indicator */}
        {isGenerating && <div className="text-center"><p>Generating image...</p></div>}

        {/* Generation Error Display */}
        {generationError && (
          <Card className="border-destructive">
            <CardHeader><CardTitle className="text-destructive">Generation Error</CardTitle></CardHeader>
            <CardContent><p>{generationError}</p></CardContent>
          </Card>
        )}

        {/* Minting Card */}
        {imageUrl && !isGenerating && (
          <Card>
            <CardHeader><CardTitle>2. Create Zora Coin</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="relative aspect-square w-full mb-4">
                <Image src={imageUrl} alt="Generated AI Image" fill className="object-contain rounded-md border"/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title ($ticker)</Label>
                <Input id="title" placeholder="Enter coin title (e.g., $MYCOIN)" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isMinting || !connectedAddress}/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="caption">Caption</Label>
                <Input id="caption" placeholder="Enter coin caption" value={caption} onChange={(e) => setCaption(e.target.value)} disabled={isMinting || !connectedAddress}/>
              </div>

              {/* Connect Wallet / Mint Button */} 
              {!connectedAddress ? (
                <Button disabled className="w-full">Connect Wallet to Mint</Button> 
              ) : (
                <Button
                  onClick={handleMint}
                  disabled={!connectedAddress || isMinting || !title || !caption || !title.startsWith('$')}
                  className="w-full"
                >
                  {isMinting ? (isConfirming ? 'Confirming...':'Creating Coin...') : `Create Coin on ${baseSepolia.name}`}
                </Button>
              )}

              {/* Title format validation hint */} 
              {title && !title.startsWith('$') && (
                <p className="text-xs text-destructive">Title must start with $</p>
              )}

              {/* Minting Status/Result */}
              {isMinting && mintTxHash && !isConfirming && (
                <div className="text-center text-sm text-muted-foreground">
                  <p>Processing transaction...{' '}
                    <Link href={`https://sepolia.basescan.org/tx/${mintTxHash}`} target="_blank" rel="noopener noreferrer" className="underline">View on Explorer</Link>
                  </p>
                </div>
              )}
              
              {mintError && (
                <Card className="border-destructive bg-destructive/10">
                  <CardHeader className="p-4"><CardTitle className="text-sm text-destructive">Minting Error</CardTitle></CardHeader>
                  <CardContent className="p-4 text-sm"><p>{mintError}</p></CardContent>
                </Card>
              )}

              {isConfirmed && mintTxHash && (
                <div className="text-center text-sm text-green-600 space-y-2 border border-green-200 bg-green-50 p-4 rounded-md">
                  <p className="font-semibold">Coin creation transaction confirmed!</p>
                  <p>Tx: <Link href={`https://sepolia.basescan.org/tx/${mintTxHash}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-800">{`${mintTxHash.substring(0, 6)}...${mintTxHash.substring(mintTxHash.length - 4)}`}</Link></p>
                  {newContractAddress && (
                     <p>Coin Contract: <Link href={`https://sepolia.basescan.org/address/${newContractAddress}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-800">{`${newContractAddress.substring(0, 6)}...${newContractAddress.substring(newContractAddress.length - 4)}`}</Link></p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
