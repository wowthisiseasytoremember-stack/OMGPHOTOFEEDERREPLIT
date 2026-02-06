import { useQuery, useMutation } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { Item } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Camera, Upload, Trash2, Download, Monitor, Plus, Loader2, Search, Grid3X3, List, ArrowUpDown, Calendar, Tag, Sparkles } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { useMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

type SortOption = "newest" | "oldest" | "name-asc" | "name-desc" | "status";
type ViewMode = "grid" | "table";

// Client-side image resize to create smaller thumbnails
async function resizeImage(file: File, maxWidth: number = 400, quality: number = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Return as base64 data URL
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export default function Home() {
  const isMobile = useMobile();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [processingCount, setProcessingCount] = useState({ done: 0, total: 0 });

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: [api.items.list.path],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", buildUrl(api.items.delete.path, { id }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      toast({ title: "Item deleted" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Item> }) => {
      await apiRequest("PUT", buildUrl(api.items.update.path, { id }), updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
    },
  });

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setProgress(10);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch(api.analyze.upload.path, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setProgress(70);
      
      await apiRequest("POST", api.items.create.path, data);
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      toast({ title: "Item identified!", description: `Found: ${data.name}` });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to analyze image" });
    } finally {
      setAnalyzing(false);
      setProgress(0);
    }
  };

  const handleBatch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setAnalyzing(true);
    setProcessingCount({ done: 0, total: files.length });
    let done = 0;
    let successCount = 0;

    for (const file of files) {
      try {
        // Create resized thumbnail client-side (400px max, 70% quality)
        const thumbnail = await resizeImage(file, 400, 0.7);
        
        const formData = new FormData();
        formData.append("image", file);
        
        const res = await fetch(api.analyze.upload.path, { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          // Add the resized thumbnail to the item data
          await apiRequest("POST", api.items.create.path, {
            ...data,
            imageUrl: thumbnail // Use resized thumbnail instead of full image
          });
          successCount++;
        }
      } catch (err) {
        console.error("Batch fail:", err);
      }
      done++;
      setProcessingCount({ done, total: files.length });
      setProgress((done / files.length) * 100);
    }
    queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
    toast({ 
      title: "Batch complete! ✨", 
      description: `Successfully processed ${successCount} of ${files.length} images` 
    });
    setAnalyzing(false);
    setProgress(0);
    setProcessingCount({ done: 0, total: 0 });
  };

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name?.toLowerCase().includes(query) ||
        item.brand?.toLowerCase().includes(query) ||
        item.year?.toLowerCase().includes(query) ||
        item.vibes?.some(v => v.toLowerCase().includes(query))
      );
    }
    
    // Sort
    switch (sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
        break;
      case "name-asc":
        result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      case "name-desc":
        result.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
        break;
      case "status":
        result.sort((a, b) => (a.status || "").localeCompare(b.status || ""));
        break;
    }
    
    return result;
  }, [items, searchQuery, sortBy]);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  Tangle Trove
                </h1>
                <p className="text-xs text-muted-foreground">AI-Powered Inventory Scanner</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => window.open(api.export.download.path)} variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
              {isMobile ? (
                <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90" onClick={() => fileInputRef.current?.click()}>
                  <Camera className="w-5 h-5" />
                  Capture
                </Button>
              ) : (
                <>
                  <Button onClick={() => batchInputRef.current?.click()} className="gap-2 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90">
                    <Plus className="w-4 h-4" />
                    Batch Upload
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Monitor className="w-4 h-4" />
                    Browser Pilot
                  </Button>
                </>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleCapture} />
              <input type="file" ref={batchInputRef} className="hidden" multiple accept="image/*" onChange={handleBatch} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Progress Bar */}
        <AnimatePresence>
          {analyzing && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card border border-border rounded-xl p-4 space-y-3"
            >
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="font-medium">Analyzing images with AI...</span>
                </div>
                <span className="text-muted-foreground">
                  {processingCount.total > 0 
                    ? `${processingCount.done} / ${processingCount.total}` 
                    : `${Math.round(progress)}%`
                  }
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search items by name, brand, year, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[160px] bg-card">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name-asc">Name A-Z</SelectItem>
                <SelectItem value="name-desc">Name Z-A</SelectItem>
                <SelectItem value="status">By Status</SelectItem>
              </SelectContent>
            </Select>
            <div className="hidden sm:flex border border-border rounded-lg overflow-hidden">
              <Button 
                variant={viewMode === "grid" ? "secondary" : "ghost"} 
                size="icon" 
                className="rounded-none"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button 
                variant={viewMode === "table" ? "secondary" : "ghost"} 
                size="icon" 
                className="rounded-none"
                onClick={() => setViewMode("table")}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        {items.length > 0 && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{filteredAndSortedItems.length} items</span>
            {searchQuery && <span className="text-primary">• filtered from {items.length}</span>}
          </div>
        )}

        {/* Grid View */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <Card key={i} className="animate-pulse bg-card h-48" />
                ))
              ) : filteredAndSortedItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="overflow-hidden bg-card border-border hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 group">
                    <CardContent className="p-0">
                      <div className="flex h-44">
                        {/* Image Section */}
                        <div className="w-36 md:w-44 bg-muted relative overflow-hidden flex-shrink-0">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                              <Camera className="w-8 h-8 text-muted-foreground/30" />
                            </div>
                          )}
                          <Badge 
                            className={`absolute top-2 left-2 text-[10px] ${
                              item.status === 'ACTIVE' 
                                ? 'bg-emerald-500/90 hover:bg-emerald-500' 
                                : 'bg-amber-500/90 hover:bg-amber-500'
                            }`}
                          >
                            {item.status === 'ACTIVE' ? '✓ Identified' : 'Review'}
                          </Badge>
                        </div>
                        
                        {/* Content Section */}
                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                          <div className="space-y-1">
                            <div className="flex justify-between items-start gap-2">
                              <Input
                                className="h-6 px-0 text-sm font-semibold bg-transparent border-none focus-visible:ring-0 truncate hover:bg-muted/50 rounded transition-colors"
                                defaultValue={item.name}
                                onBlur={(e) => updateMutation.mutate({ id: item.id, updates: { name: e.target.value } })}
                              />
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                onClick={() => deleteMutation.mutate(item.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>

                             {/* Identification fields */}
                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                              <div>
                                <span className="text-[9px] uppercase font-medium text-muted-foreground">Brand</span>
                                <Input
                                  className="h-5 text-[11px] bg-muted/50 border-none px-1.5 rounded"
                                  defaultValue={item.brand || "—"}
                                  onBlur={(e) => updateMutation.mutate({ id: item.id, updates: { brand: e.target.value } })}
                                />
                              </div>
                              <div>
                                <span className="text-[9px] uppercase font-medium text-muted-foreground">Year</span>
                                <Input
                                  className="h-5 text-[11px] bg-muted/50 border-none px-1.5 rounded"
                                  defaultValue={item.year || "—"}
                                  onBlur={(e) => updateMutation.mutate({ id: item.id, updates: { year: e.target.value } })}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-1.5">
                            <div className="flex gap-1 flex-wrap overflow-hidden max-h-4">
                              {item.vibes?.slice(0, 2).map((v, i) => (
                                <Badge key={i} variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-muted-foreground/20">
                                  {v}
                                </Badge>
                              ))}
                            </div>
                            <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                              {formatDate(item.addedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Table View */}
        {viewMode === "table" && !isLoading && (
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedItems.map((item, index) => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.brand || "—"}</TableCell>
                    <TableCell>{item.year || "—"}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={item.status === 'ACTIVE' ? "default" : "secondary"}
                        className={item.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : ''}
                      >
                        {item.status === 'ACTIVE' ? 'Identified' : 'Review'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {item.vibes?.slice(0, 2).map((v, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{v}</Badge>
                        ))}
                        {(item.vibes?.length || 0) > 2 && (
                          <Badge variant="outline" className="text-[10px]">+{(item.vibes?.length || 0) - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(item.addedAt)}</TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteMutation.mutate(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Empty State */}
        {items.length === 0 && !isLoading && (
          <div className="text-center py-20 space-y-6">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-pulse" />
              <div className="absolute inset-2 bg-gradient-to-br from-primary to-purple-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Your inventory is empty</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Upload photos of your items and let AI identify them automatically. Perfect for estate sales, vintage finds, and reseller inventory.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button 
                size="lg"
                className="gap-2 bg-gradient-to-r from-primary to-purple-500"
                onClick={() => batchInputRef.current?.click()}
              >
                <Upload className="w-5 h-5" />
                Upload Images
              </Button>
            </div>
          </div>
        )}

        {/* No Results */}
        {items.length > 0 && filteredAndSortedItems.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <Search className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <div className="space-y-1">
              <p className="text-lg font-medium">No items match your search</p>
              <p className="text-muted-foreground text-sm">Try adjusting your search terms</p>
            </div>
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
