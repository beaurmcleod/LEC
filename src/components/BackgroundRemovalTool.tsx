import { useState } from "react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { removeBackground, loadImageFromUrl } from "@/lib/backgroundRemoval";
import { Download, Loader2 } from "lucide-react";

export const BackgroundRemovalTool = () => {
  const [processing, setProcessing] = useState(false);
  const [processedImages, setProcessedImages] = useState<{ name: string; url: string }[]>([]);

  const productImages = [
    { name: "27-ott-rack", url: "/lovable-uploads/27-ott-rack.png" },
    { name: "serum-randomizer", url: "/lovable-uploads/17f0f6b4-bbf0-451e-a479-5be9e3b0b5bf.png" },
  ];

  const processImages = async () => {
    setProcessing(true);
    setProcessedImages([]);
    
    try {
      toast.info("Processing images... This may take a minute.");
      
      for (const product of productImages) {
        try {
          const img = await loadImageFromUrl(product.url);
          const blob = await removeBackground(img);
          const url = URL.createObjectURL(blob);
          
          setProcessedImages(prev => [...prev, { name: product.name, url }]);
          toast.success(`${product.name} processed!`);
        } catch (error) {
          console.error(`Error processing ${product.name}:`, error);
          toast.error(`Failed to process ${product.name}`);
        }
      }
      
      toast.success("All images processed!");
    } catch (error) {
      console.error('Error:', error);
      toast.error("Failed to process images");
    } finally {
      setProcessing(false);
    }
  };

  const downloadImage = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}-no-bg.png`;
    link.click();
  };

  return (
    <div className="fixed bottom-4 right-4 bg-card border rounded-lg p-4 shadow-lg max-w-md z-50">
      <h3 className="text-lg font-semibold mb-3">Background Removal Tool</h3>
      
      <Button
        onClick={processImages}
        disabled={processing}
        className="w-full mb-3"
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          "Remove Backgrounds"
        )}
      </Button>

      {processedImages.length > 0 && (
        <div className="space-y-2">
          {processedImages.map((img) => (
            <div key={img.name} className="flex items-center gap-2 p-2 bg-background rounded">
              <img src={img.url} alt={img.name} className="w-12 h-12 object-contain" />
              <span className="text-sm flex-1">{img.name}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadImage(img.url, img.name)}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
