import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Ensure environment variables are set
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const ZORA_ERC_20_MINTER_ADDRESS = "0x04E2516A2c207E84a1839755675dfd8eF6302F0a"; // Zora ERC20 Minter on Base Sepolia

if (!ALCHEMY_API_KEY) {
  console.error("ALCHEMY_API_KEY environment variable not set.");
}
if (!DEPLOYER_PRIVATE_KEY) {
  console.error("DEPLOYER_PRIVATE_KEY environment variable not set.");
}

export async function POST(request: Request) {
  if (!ALCHEMY_API_KEY || !DEPLOYER_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Server configuration error: Missing API key or private key." },
      { status: 500 }
    );
  }

  try {
    const { imageUrl, title, caption } = await request.json();

    if (!imageUrl || !title || !caption) {
      return NextResponse.json(
        { error: "Missing required fields: imageUrl, title, or caption." },
        { status: 400 }
      );
    }

    // 1. Create Viem clients
    const account = privateKeyToAccount(`0x${DEPLOYER_PRIVATE_KEY}`);

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(`https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
    });

    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(`https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
    });

    // 2. Prepare metadata JSON
    const metadataJson = {
        name: title,
        description: caption,
        image: imageUrl,
    };
    const metadataJsonString = JSON.stringify(metadataJson);
    const metadataDataUri = `data:application/json;base64,${Buffer.from(metadataJsonString).toString("base64")}`;

    // 3. Define Sale Strategy Parameters directly
    const saleStart = BigInt(Math.floor(Date.now() / 1000)) - BigInt(60); // Start 1 min ago
    const saleEnd = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7); // End in 7 days
    const pricePerToken = BigInt(0); // Free mint for Wave 1
    const maxTokensPerAddress = BigInt(1); // Limit 1 per address
    const fundsRecipient = account.address; // Recipient of funds

    console.log("Preparing to mint Zora ERC20 Coin...");
    console.log("Minter Address:", ZORA_ERC_20_MINTER_ADDRESS);
    console.log("Deployer Address:", account.address);
    console.log("Title ($ticker):", title);
    console.log("Metadata URI (preview):", metadataDataUri.substring(0, 100) + "...");
    console.log("Sale Start:", saleStart);
    console.log("Sale End:", saleEnd);
    console.log("Price Per Token:", pricePerToken);
    console.log("Max Tokens Per Address:", maxTokensPerAddress);
    console.log("Funds Recipient:", fundsRecipient);

    // 4. Call the Zora ERC20 Minter Contract
    const { request: simulateRequest } = await publicClient.simulateContract({
        address: ZORA_ERC_20_MINTER_ADDRESS,
        abi: ZoraErc20MinterAbi,
        functionName: 'createCoin',
        args: [
            title,                  // string calldata name,
            title,                  // string calldata symbol,
            account.address,        // address initialOwner,
            BigInt(1000),           // uint256 initialSupply,
            BigInt(10000),          // uint256 maxSupply,
            saleStart,              // uint64 saleStart,
            saleEnd,                // uint64 saleEnd,
            maxTokensPerAddress,    // uint64 maxTokensPerAddress,
            pricePerToken,          // uint96 pricePerToken,
            fundsRecipient,         // address fundsRecipient,
            metadataDataUri         // string calldata metadataURI
        ],
        account: account,
    });

    console.log("Simulation successful. Sending transaction...");

    const txHash = await walletClient.writeContract(simulateRequest);

    console.log("Transaction sent. Hash:", txHash);

    // 5. Wait for transaction receipt (optional but good for confirmation)
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    console.log("Transaction confirmed. Receipt:", receipt);

    if (receipt.status === 'success') {
        // TODO: Potentially extract the new coin address from logs if needed
        return NextResponse.json({ success: true, txHash: txHash });
    } else {
        return NextResponse.json(
            { error: "Transaction failed on-chain.", details: receipt },
            { status: 500 }
        );
    }

  } catch (error: unknown) {
    console.error("Error minting Zora Coin:", error);
    let errorMessage = "An unknown error occurred during minting.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    // Check for Viem/RPC specific errors if possible
    // e.g., if (error instanceof BaseError) { ... }
    return NextResponse.json(
      { error: `Failed to mint Zora Coin: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Define the ABI for the ZoraErc20Minter createCoin function
// Found via Basescan: https://sepolia.basescan.org/address/0x04e2516a2c207e84a1839755675dfd8eef6302f0a#code
const ZoraErc20MinterAbi = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "symbol",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "initialOwner",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "initialSupply",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "maxSupply",
        "type": "uint256"
      },
      {
        "internalType": "uint64",
        "name": "saleStart",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "saleEnd",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "maxTokensPerAddress",
        "type": "uint64"
      },
      {
        "internalType": "uint96",
        "name": "pricePerToken",
        "type": "uint96"
      },
      {
        "internalType": "address",
        "name": "fundsRecipient",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "metadataURI",
        "type": "string"
      }
    ],
    "name": "createCoin",
    "outputs": [
      {
        "internalType": "address",
        "name": "tokenContract",
        "type": "address"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  }
]; 