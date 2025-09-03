/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { generateCompositeImage } from './services/geminiService';
import { Product } from './components/types';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import ObjectCard from './components/ObjectCard';
import Spinner from './components/Spinner';
import DebugModal from './components/DebugModal';

// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

const loadingMessages = [
    "Analyzing the scene...",
    "Identifying the target surface with AI...",
    "Crafting the perfect visualization prompt...",
    "Applying product with photorealistic rendering...",
    "Assembling the final scene..."
];

const DEFAULT_PRODUCTS: Product[] = [
  // Wall
  { id: 1, name: 'Ceramic Subway Tile', imageUrl: '/assets/products/wall_tile_1.jpeg', surfaceType: 'wall', category: 'Tiles', applicationType: 'tile' },
  { id: 2, name: 'Hexagonal Pattern', imageUrl: '/assets/products/wall_tile_2.jpeg', surfaceType: 'wall', category: 'Tiles', applicationType: 'tile' },
  { id: 3, name: 'Botanical Print', imageUrl: '/assets/products/wallpaper_1.jpeg', surfaceType: 'wall', category: 'Wallpaper', applicationType: 'tile' },
  { id: 4, name: 'Abstract Lines', imageUrl: '/assets/products/wallpaper_2.jpeg', surfaceType: 'wall', category: 'Wallpaper', applicationType: 'tile' },
  { id: 5, name: 'Forest Mural', imageUrl: '/assets/products/mural_1.jpeg', surfaceType: 'wall', category: 'Mural', applicationType: 'single' },
  { id: 6, name: 'Black Gallery Frame', imageUrl: '/assets/products/frame_1.jpeg', surfaceType: 'wall', category: 'Photo Frame', applicationType: 'single' },
  // Floor
  { id: 7, name: 'Persian Style Rug', imageUrl: '/assets/products/rug_1.jpeg', surfaceType: 'floor', category: 'Rug', applicationType: 'single' },
  { id: 8, name: 'Modern Geometric Rug', imageUrl: '/assets/products/rug_2.jpeg', surfaceType: 'floor', category: 'Rug', applicationType: 'single' },
  { id: 9, name: 'Marble Floor Tile', imageUrl: '/assets/products/floor_tile_1.jpeg', surfaceType: 'floor', category: 'Tile', applicationType: 'tile' },
  { id: 10, name: 'Hardwood Parquet', imageUrl: '/assets/products/floor_tile_2.jpeg', surfaceType: 'floor', category: 'Tile', applicationType: 'tile' },
];

const CATEGORIES = {
  wall: ['Tiles', 'Wallpaper', 'Mural', 'Photo Frame'],
  floor: ['Rug', 'Tile']
};

const App: React.FC = () => {
  const [sceneImage, setSceneImage] = useState<File | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customProducts, setCustomProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  
  const [activeSurface, setActiveSurface] = useState<'wall' | 'floor'>('wall');
  const [activeCategory, setActiveCategory] = useState<string>('Tiles');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [persistedOrbPosition, setPersistedOrbPosition] = useState<{x: number, y: number} | null>(null);
  const [debugImageUrl, setDebugImageUrl] = useState<string | null>(null);
  const [debugPrompt, setDebugPrompt] = useState<string | null>(null);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);

  const sceneImgRef = useRef<HTMLImageElement>(null);
  const customProductInputRef = useRef<HTMLInputElement>(null);
  
  const sceneImageUrl = sceneImage ? URL.createObjectURL(sceneImage) : null;

  const handleSceneUpload = (file: File) => {
    setSceneImage(file);
    const newHistory = [file];
    setHistory(newHistory);
    setHistoryIndex(0);
    resetProductState();
  };

  const handleInstantStart = useCallback(async () => {
    setError(null);
    try {
      const sceneResponse = await fetch('/assets/scene.jpeg');
      if (!sceneResponse.ok) throw new Error('Failed to load default scene image');
      const sceneBlob = await sceneResponse.blob();
      const sceneFile = new File([sceneBlob], 'scene.jpeg', { type: 'image/jpeg' });
      handleSceneUpload(sceneFile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Could not load default images. Details: ${errorMessage}`);
      console.error(err);
    }
  }, []);

  const handleProductApply = useCallback(async (position: {x: number, y: number}, relativePosition: { xPercent: number; yPercent: number; }) => {
    if (!selectedProduct || !sceneImage) {
      setError('Please select a product before clicking on the scene.');
      return;
    }
    
    // Fetch product image file (could be from a URL or already a File)
    let productFile: File;
    try {
      const response = await fetch(selectedProduct.imageUrl);
      const blob = await response.blob();
      productFile = new File([blob], selectedProduct.name, {type: blob.type});
    } catch (err) {
      setError(`Could not load the selected product image. Please try again.`);
      console.error(err);
      return;
    }

    setPersistedOrbPosition(position);
    setIsLoading(true);
    setError(null);

    try {
      const { finalImageUrl, debugImageUrl, finalPrompt } = await generateCompositeImage(
        productFile, 
        selectedProduct.name,
        sceneImage,
        sceneImage.name,
        relativePosition,
        selectedProduct.applicationType
      );

      setDebugImageUrl(debugImageUrl);
      setDebugPrompt(finalPrompt);
      
      const newSceneFile = dataURLtoFile(finalImageUrl, `generated-scene-${Date.now()}.jpeg`);
      
      // Update history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newSceneFile);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      setSceneImage(newSceneFile);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate the image. ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
      setPersistedOrbPosition(null);
    }
  }, [selectedProduct, sceneImage, history, historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setSceneImage(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSceneImage(history[newIndex]);
    }
  };

  const resetProductState = () => {
    setSelectedProduct(null);
    setPersistedOrbPosition(null);
    setDebugImageUrl(null);
    setDebugPrompt(null);
  };
  
  const handleReset = useCallback(() => {
    setSceneImage(null);
    setError(null);
    setIsLoading(false);
    setHistory([]);
    setHistoryIndex(-1);
    setCustomProducts([]);
    setAllProducts(DEFAULT_PRODUCTS);
    resetProductState();
  }, []);

  const handleChangeScene = useCallback(() => {
    setSceneImage(null);
    setHistory([]);
    setHistoryIndex(-1);
    resetProductState();
  }, []);

  const handleCustomProductUpload = (event: React.ChangeEvent<HTMLInputElement>, applicationType: 'tile' | 'single') => {
    const file = event.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      const newProduct: Product = {
        id: Date.now(),
        name: file.name,
        imageUrl,
        surfaceType: activeSurface,
        category: activeCategory,
        applicationType,
      };
      const newCustomProducts = [...customProducts, newProduct];
      setCustomProducts(newCustomProducts);
      setAllProducts([...DEFAULT_PRODUCTS, ...newCustomProducts]);
      setSelectedProduct(newProduct);
    }
    // Reset file input value to allow uploading the same file again
    if (event.target) {
        event.target.value = '';
    }
  };

  useEffect(() => {
    // Set default active category when surface changes
    setActiveCategory(CATEGORIES[activeSurface][0]);
  }, [activeSurface]);

  useEffect(() => {
    // Clean up object URLs for custom products
    return () => {
      customProducts.forEach(p => URL.revokeObjectURL(p.imageUrl));
    }
  }, [customProducts]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isLoading) {
      setLoadingMessageIndex(0); // Reset on start
      interval = setInterval(() => {
        setLoadingMessageIndex(prevIndex => (prevIndex + 1) % loadingMessages.length);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  const renderContent = () => {
    if (error) {
       return (
           <div className="text-center animate-fade-in bg-red-50 border border-red-200 p-8 rounded-lg max-w-2xl mx-auto">
            <h2 className="text-3xl font-extrabold mb-4 text-red-800">An Error Occurred</h2>
            <p className="text-lg text-red-700 mb-6">{error}</p>
            <button
                onClick={handleReset}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
              >
                Try Again
            </button>
          </div>
        );
    }
    
    if (!sceneImage) {
      return (
        <div className="w-full max-w-4xl mx-auto animate-fade-in flex flex-col items-center">
          <h2 className="text-2xl font-extrabold text-center mb-5 text-zinc-800">Upload a Photo of Your Room</h2>
          <ImageUploader 
            id="scene-uploader"
            onFileSelect={handleSceneUpload}
            imageUrl={sceneImageUrl}
          />
          <div className="text-center mt-10 min-h-[4rem] flex flex-col justify-center items-center">
            <p className="text-zinc-500 animate-fade-in mt-2">
              Or click{' '}
              <button
                onClick={handleInstantStart}
                className="font-bold text-blue-600 hover:text-blue-800 underline transition-colors"
              >
                here
              </button>
              {' '}for an instant start.
            </p>
          </div>
        </div>
      );
    }

    const visibleProducts = allProducts.filter(p => p.surfaceType === activeSurface && p.category === activeCategory);

    return (
      <div className="w-full max-w-screen-2xl mx-auto animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1 bg-zinc-50 rounded-lg p-4 h-full">
            <h2 className="text-xl font-extrabold mb-4 text-zinc-800">Products</h2>
            {/* Surface Selector */}
            <div className="flex bg-zinc-200 rounded-lg p-1 mb-4">
              <button onClick={() => setActiveSurface('wall')} className={`flex-1 p-2 rounded-md font-semibold transition-colors ${activeSurface === 'wall' ? 'bg-white shadow' : 'text-zinc-600'}`}>Wall</button>
              <button onClick={() => setActiveSurface('floor')} className={`flex-1 p-2 rounded-md font-semibold transition-colors ${activeSurface === 'floor' ? 'bg-white shadow' : 'text-zinc-600'}`}>Floor</button>
            </div>
            {/* Category Selector */}
            <div className="flex flex-wrap gap-2 mb-4">
              {CATEGORIES[activeSurface].map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1 text-sm rounded-full font-semibold transition-colors ${activeCategory === cat ? 'bg-blue-600 text-white' : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'}`}>{cat}</button>
              ))}
            </div>
            {/* Product List */}
            <div className="grid grid-cols-2 gap-4 max-h-[40vh] overflow-y-auto pr-2">
              {visibleProducts.map(product => (
                <div key={product.id} onClick={() => setSelectedProduct(product)}>
                  <ObjectCard product={product} isSelected={selectedProduct?.id === product.id} />
                </div>
              ))}
            </div>
            {/* Custom Upload */}
            <div className="mt-4 border-t pt-4">
              <input type="file" ref={customProductInputRef} onChange={(e) => handleCustomProductUpload(e, 'tile')} accept="image/png, image/jpeg" className="hidden" />
              <button onClick={() => customProductInputRef.current?.click()} className="w-full text-center bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold py-2 px-4 rounded-lg text-sm transition-colors shadow-sm">
                Upload Custom Product
              </button>
               <p className="text-xs text-zinc-500 mt-2 text-center">Custom uploads will be treated as repeating tiles for the selected category.</p>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3 flex flex-col">
            <div className="flex-grow flex items-center justify-center">
              <ImageUploader 
                  ref={sceneImgRef}
                  id="scene-uploader" 
                  onFileSelect={handleSceneUpload} 
                  imageUrl={sceneImageUrl}
                  isPlacementMode={!!selectedProduct && !isLoading}
                  onSurfaceClick={handleProductApply}
                  persistedOrbPosition={persistedOrbPosition}
                  showDebugButton={!!debugImageUrl && !isLoading}
                  onDebugClick={() => setIsDebugModalOpen(true)}
              />
            </div>
            <div className="text-center mt-4 min-h-[6rem] flex flex-col justify-center items-center">
               {isLoading ? (
                 <div className="animate-fade-in">
                    <Spinner />
                    <p className="text-xl mt-4 text-zinc-600 transition-opacity duration-500">{loadingMessages[loadingMessageIndex]}</p>
                 </div>
               ) : (
                 <>
                    <p className="text-zinc-500 animate-fade-in mb-4">
                        {selectedProduct ? `Selected: ${selectedProduct.name}. Click a surface in the scene to apply.` : 'Select a product from the sidebar to begin.'}
                    </p>
                    <div className="flex items-center gap-4">
                        <button onClick={handleChangeScene} className="text-sm text-blue-600 hover:text-blue-800 font-semibold">Change Scene</button>
                        <div className="flex items-center gap-2">
                            <button onClick={handleUndo} disabled={historyIndex <= 0} className="px-3 py-1 bg-white border rounded-md shadow-sm disabled:opacity-50">Undo</button>
                            <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="px-3 py-1 bg-white border rounded-md shadow-sm disabled:opacity-50">Redo</button>
                        </div>
                    </div>
                 </>
               )}
            </div>
          </main>
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen bg-white text-zinc-800 flex flex-col items-center p-4 md:p-8">
      <Header />
      <main className="w-full mt-8">
        {renderContent()}
      </main>
      <DebugModal 
        isOpen={isDebugModalOpen} 
        onClose={() => setIsDebugModalOpen(false)}
        imageUrl={debugImageUrl}
        prompt={debugPrompt}
      />
    </div>
  );
};

export default App;
