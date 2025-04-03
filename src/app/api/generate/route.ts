import Replicate from 'replicate';
import { NextResponse } from 'next/server';
import { Readable } from 'stream'; // Import Readable

// Helper function to read a stream into a buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

// Using Stable Diffusion v1.5 (often available on free tiers)
const SD_V1_5_MODEL = "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf";

export async function POST(request: Request) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "Replicate API token not configured." },
      { status: 500 }
    );
  }

  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    console.log(`Generating image with prompt: ${prompt}`);

    const output = await replicate.run(SD_V1_5_MODEL, {
      input: {
        prompt: prompt,
        // Parameters might differ slightly from SDXL, adjust if needed
        // image_dimensions: "512x512", // SD 1.5 often defaults to 512x512
      },
    });

    console.log('Replicate output type:', typeof output, Array.isArray(output) ? `Array length: ${output.length}`: '');
    if (Array.isArray(output) && output.length > 0) {
        console.log('First element type:', typeof output[0]);
    }

    // Check the type of the first element in the output array
    if (Array.isArray(output) && output.length > 0) {
      const firstElement = output[0];

      if (typeof firstElement === 'string' && firstElement.length > 0) {
        // Handle the case where it returns a string URL
        console.log("Received string URL output from Replicate.");
        return NextResponse.json({ imageUrl: firstElement });

      } else if (typeof firstElement === 'object' && firstElement !== null) {
        // Handle the case where it likely returns a stream-like object
        console.log("Received object output from Replicate, attempting to treat as stream...");
        try {
          // Assume the object is sufficiently stream-like for streamToBuffer
          // Cast to Readable, although the actual iteration is duck-typed in streamToBuffer
          const stream = firstElement as Readable;
          const buffer = await streamToBuffer(stream);
          const base64String = buffer.toString('base64');
          const dataUrl = `data:image/png;base64,${base64String}`;
          console.log("Data URL generated (first 100 chars):", dataUrl.substring(0, 100) + "...");
          return NextResponse.json({ imageUrl: dataUrl });
        } catch (streamError: unknown) {
          console.error("Error processing stream-like object:", streamError);
          // Log the object that failed processing
          console.error('Object that caused stream processing error:');
          console.dir(firstElement, { depth: null });
          return NextResponse.json(
            { error: "Failed to process image data received from provider." },
            { status: 500 }
          );
        }
      } else {
        // Handle cases where the first element is neither a string nor a recognized object
        console.error('Invalid or unexpected type for output[0]:', typeof firstElement);
        console.error('Output[0] value:');
        console.dir(firstElement, { depth: null });
        return NextResponse.json(
            { error: "Failed to generate image. Unexpected output format received from provider." },
            { status: 500 }
          );
      }
    } else {
      // Handle cases where output is not an array or is empty
      console.error('Unexpected output format (not a non-empty array):', output);
      return NextResponse.json(
        { error: "Failed to generate image. Unexpected output format received from provider." },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("Error calling Replicate API or processing stream:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: `Failed to generate image: ${errorMessage}` },
      { status: 500 }
    );
  }
} 