
"use client";

import { useState, useRef, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FileUploadZone } from '@/components/feature/file-upload-zone';
import PdfPagePreview from '@/components/feature/pdf-page-preview';
import { CheckCircle, Loader2, Info, ArrowDownToLine, Plus, ArrowRightCircle, Minimize2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { readFileAsDataURL } from '@/lib/file-utils';
import { downloadDataUri } from '@/lib/download-utils';
import { compressPdfAction, type CompressionLevel } from './actions';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface CompressionResultStats {
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
}

const PREVIEW_TARGET_HEIGHT_COMPRESS = 400; 

export default function CompressPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionStats, setCompressionStats] = useState<CompressionResultStats | null>(null);
  const [compressedPdfUri, setCompressedPdfUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>("recommended");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelectedForUploadZone = (selectedFiles: File[]) => {
    if (selectedFiles.length > 0) {
      // Compress tool handles one file at a time.
      handleNewFile(selectedFiles[0]);
    }
  };
  
  const handleFileChangeFromInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      // Compress tool handles one file at a time.
      handleNewFile(event.target.files[0]);
    }
  };

  const handleNewFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setCompressionStats(null);
    setCompressedPdfUri(null);
    setError(null);
    try {
      const dataUri = await readFileAsDataURL(selectedFile);
      setPdfDataUri(dataUri);
    } catch (e: any) {
      setError(e.message || "Failed to read file.");
      toast({ title: "File Read Error", description: e.message, variant: "destructive" });
      setPdfDataUri(null);
      setFile(null);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPdfDataUri(null);
    setCompressionStats(null);
    setCompressedPdfUri(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset file input value
    }
    toast({ description: "File removed." });
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes < 0) bytes = 0;
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleCompress = async () => {
    if (!file || !pdfDataUri) {
      toast({
        title: "No file selected",
        description: "Please select a PDF file to compress.",
        variant: "destructive",
      });
      return;
    }

    setIsCompressing(true);
    setCompressionStats(null);
    setCompressedPdfUri(null);
    setError(null);

    try {
      const result = await compressPdfAction({ pdfDataUri, compressionLevel });

      if (result.error) {
        setError(result.error);
        toast({ title: "Compression Error", description: result.error, variant: "destructive" });
      } else if (result.compressedPdfDataUri && result.originalSize !== undefined && result.compressedSize !== undefined) {
        const reduction = result.originalSize > 0 ? ((result.originalSize - result.compressedSize) / result.originalSize) * 100 : 0;
        setCompressionStats({
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            reductionPercentage: parseFloat(reduction.toFixed(2))
        });
        setCompressedPdfUri(result.compressedPdfDataUri);
        downloadDataUri(result.compressedPdfDataUri, `compressed_${file.name}`);
        toast({ title: "Compression Successful!", description: `Your PDF has been compressed. Download has started.` });
      }
    } catch (e: any) {
      const errorMessage = e.message || "An unexpected error occurred during compression.";
      setError(errorMessage);
      toast({ title: "Compression Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRedownload = () => {
    if (compressedPdfUri && file) {
        downloadDataUri(compressedPdfUri, `compressed_${file.name}`);
        toast({ description: "Download started again." });
    } else {
        toast({ description: "No compressed file available to download. Please process a file first.", variant: "destructive" });
    }
  };

  const compressionOptions: { value: CompressionLevel; label: string; description: string }[] = [
    { value: "extreme", label: "EXTREME COMPRESSION", description: "Less quality, high compression" },
    { value: "recommended", label: "RECOMMENDED COMPRESSION", description: "Good quality, good compression" },
    { value: "less", label: "LESS COMPRESSION", description: "High quality, less compression" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 md:p-0">
      <header className="text-center py-8">
        <Minimize2 className="mx-auto h-12 w-12 text-primary mb-3" />
        <h1 className="text-4xl font-bold tracking-tight">Compress PDF File</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Reduce the file size of your PDF while maintaining quality. This tool processes one PDF at a time.
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Panel: File Upload / Preview */}
        <div className="lg:w-2/3 relative min-h-[400px] lg:min-h-[500px] flex flex-col items-center justify-center bg-card border rounded-lg shadow-md p-6">
          {!pdfDataUri && (
            <div className="w-full max-w-md">
              <FileUploadZone 
                onFilesSelected={handleFileSelectedForUploadZone} 
                multiple={false} // Explicitly single file for compression tool
                accept="application/pdf" 
              />
            </div>
          )}
          {pdfDataUri && file && (
            <>
              <div className="w-full h-full flex items-center justify-center">
                 <PdfPagePreview pdfDataUri={pdfDataUri} pageIndex={0} targetHeight={PREVIEW_TARGET_HEIGHT_COMPRESS} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground truncate w-full text-center" title={file.name}>{file.name}</p>
               <Button
                variant="destructive"
                size="icon"
                className="absolute top-4 left-4 h-10 w-10 rounded-full shadow-lg hover:bg-destructive/90"
                onClick={handleRemoveFile}
                aria-label="Remove current PDF file"
              >
                <X className="h-5 w-5" />
              </Button>
            </>
          )}
           <Button
            variant="default"
            size="icon"
            className="absolute top-4 right-4 h-12 w-12 rounded-full shadow-lg"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Add or change PDF file"
          >
            <Plus className="h-6 w-6" />
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChangeFromInput}
            accept="application/pdf"
            className="hidden" // Still single file selection here
          />
        </div>

        {/* Right Panel: Options & Action */}
        <div className="lg:w-1/3 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Compression level</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={compressionLevel} onValueChange={(value) => setCompressionLevel(value as CompressionLevel)} className="space-y-2">
                {compressionOptions.map((option) => (
                  <Label
                    key={option.value}
                    htmlFor={`comp-${option.value}`}
                    className={cn(
                      "flex flex-col p-3 border rounded-lg cursor-pointer hover:border-primary transition-all",
                      compressionLevel === option.value && "border-primary ring-2 ring-primary bg-primary/5"
                    )}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm text-primary">{option.label}</span>
                      <RadioGroupItem value={option.value} id={`comp-${option.value}`} className="sr-only" />
                      {compressionLevel === option.value && <CheckCircle className="h-5 w-5 text-green-500" />}
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">{option.description}</span>
                  </Label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
          <Button
            onClick={handleCompress}
            disabled={!file || isCompressing}
            className="w-full text-lg py-6"
            size="lg"
          >
            {isCompressing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Compressing...
              </>
            ) : (
              <>
                <ArrowRightCircle className="mr-2 h-5 w-5" />
                Compress PDF
              </>
            )}
          </Button>
        </div>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mt-6 max-w-2xl mx-auto">
          <Info className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {compressionStats && compressedPdfUri && !error && (
        <Card className="mt-8 max-w-2xl mx-auto shadow-lg">
            <CardHeader>
                <CardTitle className="text-center text-xl">Compression Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert variant="default" className="bg-green-50 border-green-200 text-green-700">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <AlertTitle>Compression Complete!</AlertTitle>
                    <AlertDescription className="text-green-600">
                        Your PDF has been successfully compressed. Download started automatically.
                    </AlertDescription>
                </Alert>
                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">Original Size:</span>
                        <span>{formatBytes(compressionStats.originalSize)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">Compressed Size:</span>
                        <span>{formatBytes(compressionStats.compressedSize)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold text-primary mb-2">
                        <span>Reduction:</span>
                        <span>{compressionStats.reductionPercentage}%</span>
                    </div>
                    <Progress value={compressionStats.reductionPercentage} className="h-3" aria-label={`${compressionStats.reductionPercentage}% reduction`} />
                </div>
                <Button
                    onClick={handleRedownload}
                    variant="outline"
                    className="w-full mt-2"
                    disabled={!compressedPdfUri || !file || isCompressing}
                >
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Download Compressed PDF Again
                </Button>
            </CardContent>
            <CardFooter>
                <p className="text-xs text-muted-foreground text-center w-full">
                    Note: Compression effectiveness varies. For already optimized or primarily text-based PDFs, reduction may be minimal.
                </p>
            </CardFooter>
        </Card>
      )}
    </div>
  );
}
