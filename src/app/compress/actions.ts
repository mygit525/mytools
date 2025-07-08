
"use server";

import { PDFDocument } from 'pdf-lib';
// Node.js Buffer should be available in Next.js server actions.
// Explicit import for type safety if using a specific Buffer type.
import type { Buffer } from 'buffer'; 

export type CompressionLevel = "extreme" | "recommended" | "less";

export interface CompressPdfInput {
  pdfDataUri: string;
  compressionLevel: CompressionLevel;
}

export interface CompressPdfOutput {
  compressedPdfDataUri?: string;
  originalSize?: number;
  compressedSize?: number;
  error?: string;
}

export async function compressPdfAction(input: CompressPdfInput): Promise<CompressPdfOutput> {
  if (!input.pdfDataUri) {
    return { error: "No PDF file provided for compression." };
  }

  try {
    if (!input.pdfDataUri.startsWith('data:application/pdf;base64,')) {
      console.error('Invalid data URI format for compress PDF:', input.pdfDataUri.substring(0,100));
      return { error: `Invalid PDF data format. Please ensure the file is a valid PDF.` };
    }
    
    const base64String = input.pdfDataUri.split(',')[1];
    const pdfBytes = Buffer.from(base64String, 'base64');
    const originalSize = pdfBytes.length;

    // Load the PDF document
    // ignoreEncryption is true to attempt processing, but some encrypted files might still fail.
    const pdfDoc = await PDFDocument.load(pdfBytes, { 
        ignoreEncryption: true,
    });
    
    // Note: pdf-lib primarily compresses by optimizing PDF structure (e.g., object streams).
    // The 'compressionLevel' input is received but not directly used to alter pdf-lib's behavior
    // in this iteration, as pdf-lib doesn't offer explicit quality/ratio settings for general compression.
    // For example, useObjectStreams is generally beneficial and enabled by default in modern pdf-lib.
    console.log(`Compression action called with level: ${input.compressionLevel}`);

    const compressedPdfBytes = await pdfDoc.save({
        useObjectStreams: true, 
    });
    const compressedSize = compressedPdfBytes.length;

    if (compressedSize === 0 && pdfDoc.getPageCount() > 0) {
        console.warn("Compression resulted in an empty PDF document, but original had pages.");
    }
     if (pdfDoc.getPageCount() === 0 && originalSize > 0) {
        console.warn("Original PDF had no pages.");
    }

    const compressedPdfDataUri = `data:application/pdf;base64,${Buffer.from(compressedPdfBytes).toString('base64')}`;
    
    return { compressedPdfDataUri, originalSize, compressedSize };

  } catch (error: any) {
    console.error("Error compressing PDF:", error);
    if (error.message && error.message.toLowerCase().includes('encrypted') && !error.message.toLowerCase().includes('ignoreencryption')) {
        return { error: "The PDF is encrypted with restrictions that prevent modification. Please provide a decrypted PDF."}
    }
    return { error: error.message || "An unexpected error occurred while compressing the PDF." };
  }
}
