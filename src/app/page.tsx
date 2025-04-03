'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link'; // Import Link
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from "@/components/ui/label";

export default function Home() {
  // Generation State
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coin Metadata State
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');

  // Minting State
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setImageUrl(null); // Clear previous image
    setTitle(''); // Clear previous title
    setCaption(''); // Clear previous caption
    setTxHash(null); // Clear previous tx hash
    setMintError(null); // Clear previous mint error

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        // Try to parse error message from response body
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          // If parsing fails, use the status text
          console.error("Failed to parse error response:", parseError); // Log the parse error
          throw new Error(response.statusText || 'Failed to generate image');
        }
        throw new Error(errorData.error || 'Failed to generate image');
      }

      const data = await response.json();
      // Ensure imageUrl is not an empty string, set to null otherwise
      setImageUrl(data.imageUrl || null);
    } catch (err: unknown) { // Use unknown instead of any
      console.error('Generation error:', err);
      // Type check the error before accessing properties
      let errorMessage = 'An unexpected error occurred.';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    }

    setIsLoading(false);
  };

  const handleMint = async () => {
    if (!imageUrl || !title || !caption) return; // Should not happen if button is enabled correctly

    setIsMinting(true);
    setMintError(null);
    setTxHash(null);

    try {
      const response = await fetch('/api/mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl, title, caption }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error("Failed to parse mint error response:", parseError);
          throw new Error(response.statusText || 'Failed to mint coin');
        }
        throw new Error(errorData.error || 'Failed to mint coin');
      }

      const data = await response.json();
      if (data.success && data.txHash) {
        setTxHash(data.txHash);
        // Optionally reset form or provide further success feedback
      } else {
        // Handle cases where success might be false but no error thrown in fetch
        throw new Error(data.error || 'Minting completed but no transaction hash received.');
      }

    } catch (err: unknown) {
      console.error('Minting error:', err);
      let errorMessage = 'An unexpected error occurred during minting.';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setMintError(errorMessage);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold text-center">AI Image & Zora Coin Generator</h1>

        {/* Generation Card */}
        <Card>
          <CardHeader>
            <CardTitle>1. Generate Image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Enter your image prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading || isMinting}
            />
            <Button
              onClick={handleGenerate}
              disabled={isLoading || isMinting || !prompt}
              className="w-full"
            >
              {isLoading ? 'Generating...' : 'Generate Image'}
            </Button>
          </CardContent>
        </Card>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="text-center">
            <p>Generating image...</p>
          </div>
        )}

        {/* Generation Error Display */}
        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Generation Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Minting Card (shown after image generation) */}
        {imageUrl && !isLoading && (
          <Card>
            <CardHeader>
              <CardTitle>2. Create Zora Coin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image Display */}
              <div className="relative aspect-square w-full mb-4">
                <Image
                  src={imageUrl}
                  alt="Generated AI Image"
                  fill
                  className="object-contain rounded-md border"
                />
              </div>
              {/* Title Input */}
              <div className="space-y-2">
                <Label htmlFor="title">Title ($ticker)</Label>
                <Input
                  id="title"
                  placeholder="Enter coin title (e.g., $MYART)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isMinting}
                />
              </div>
              {/* Caption Input */}
              <div className="space-y-2">
                <Label htmlFor="caption">Caption</Label>
                <Input
                  id="caption"
                  placeholder="Enter coin caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  disabled={isMinting}
                />
              </div>

              {/* Mint Button */}
              <Button
                onClick={handleMint}
                disabled={isMinting || !title || !caption}
                className="w-full"
              >
                {isMinting ? 'Creating Coin...' : 'Create Coin on Base Sepolia'}
              </Button>

              {/* Minting Status/Result */}
              {isMinting && (
                <div className="text-center text-sm text-muted-foreground">
                  <p>Minting... Please wait. This may take a moment.</p>
                </div>
              )}

              {mintError && (
                <Card className="border-destructive bg-destructive/10">
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm text-destructive">Minting Error</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 text-sm">
                    <p>{mintError}</p>
                  </CardContent>
                </Card>
              )}

              {txHash && (
                <div className="text-center text-sm text-green-600 space-y-2 border border-green-200 bg-green-50 p-4 rounded-md">
                  <p className="font-semibold">Coin creation initiated successfully!</p>
                  <p>
                    Transaction Hash:{' '}
                    <Link
                      href={`https://sepolia.basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-green-800"
                    >
                      {`${txHash.substring(0, 6)}...${txHash.substring(txHash.length - 4)}`}
                    </Link>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    (It may take a few moments for the transaction to be confirmed on the blockchain)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
