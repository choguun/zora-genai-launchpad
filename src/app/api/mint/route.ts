import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
// Import only createCreatorClient from the SDK
import { createCreatorClient } from '@zoralabs/protocol-sdk';

// Ensure environment variables are set
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

if (!ALCHEMY_API_KEY) {
  console.error("ALCHEMY_API_KEY environment variable not set.");
}
if (!DEPLOYER_PRIVATE_KEY) {
  console.error("DEPLOYER_PRIVATE_KEY environment variable not set.");
}

export async function POST(httpRequest: Request) {
  if (!ALCHEMY_API_KEY || !DEPLOYER_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Server configuration error: Missing API key or private key." },
      { status: 500 }
    );
  }

  try {
    const { imageUrl, title, caption } = await httpRequest.json();

    if (!imageUrl || !title || !caption) {
      return NextResponse.json(
        { error: "Missing required fields: imageUrl, title, or caption." },
        { status: 400 }
      );
    }

    // Validate that the title (used as symbol) starts with '$'
    if (!title.startsWith('$')) {
      return NextResponse.json(
        { error: 'Invalid format: Title ($ticker) must start with a "$" sign.' },
        { status: 400 }
      );
    }

    // 1. Create Viem clients
    const account = privateKeyToAccount(`0x${DEPLOYER_PRIVATE_KEY}`);

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(`https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
      pollingInterval: 4000,
    });

    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(`https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
    });

    // 2. Prepare minimal metadata JSON (Image URL kept off-chain for Wave 1)
    const metadataJson = {
        name: title,
        description: caption,
        // image: imageUrl,
    };
    const metadataJsonString = JSON.stringify(metadataJson);
    const metadataDataUri = `data:application/json;base64,${Buffer.from(metadataJsonString).toString("base64")}`;

    // 3. Instantiate the Zora Creator Client
    // @ts-expect-error - If SDK/Viem updates fix this, the build will error here
    const creatorClient = createCreatorClient({ chainId: baseSepolia.id, publicClient });

    // 4. Prepare the create1155 transaction parameters using the SDK
    const { parameters } = await creatorClient.create1155({
      contract: {
        name: title,
        uri: metadataDataUri,
      },
      token: {
        tokenMetadataURI: metadataDataUri,
      },
      account: account.address,
    });
    console.log("SDK prepared parameters:", parameters);

    // 5. Send transaction using writeContract
    console.log("Sending transaction via writeContract...");

    // Pass SDK parameters AND the account explicitly to writeContract
    const txHash = await walletClient.writeContract({
        ...parameters,
        account: account
    });

    console.log("Transaction sent. Hash:", txHash);

    // 6. Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Ensure correct success response with txHash
    if (receipt.status === 'success') {
      return NextResponse.json({ success: true, txHash: txHash });
    } else {
      return NextResponse.json(
          { error: "Transaction failed on-chain.", details: receipt },
          { status: 500 }
      );
    }

  } catch (error: unknown) {
    // ... error handling, potentially log parameters if simulation fails ...
    console.error("Error minting Zora Coin via SDK:", error);
    let errorMessage = "An unknown error occurred during minting.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json(
      { error: `Failed to mint Zora Coin: ${errorMessage}` },
      { status: 500 }
    );
  }
} 