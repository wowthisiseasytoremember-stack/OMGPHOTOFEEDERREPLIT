import { useQuery, useMutation } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { Item } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Camera, Upload, Trash, Download, Monitor, Plus, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { useMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const isMobile = useMobile();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

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
    let done = 0;
    for (const file of files) {
      const formData = new FormData();
      formData.append("image", file);
      try {
        const res = await fetch(api.analyze.upload.path, { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          await apiRequest("POST", api.items.create.path, data);
        }
      } catch (err) {
        console.error("Batch fail:", err);
      }
      done++;
      setProgress((done / files.length) * 100);
    }
    queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
    toast({ title: "Batch complete", description: `Processed ${done} images` });
    setAnalyzing(false);
    setProgress(0);
  };

  const sortedItems = [...items].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Tangle Trove</h1>
            <p className="text-muted-foreground">Image-to-JSON Reseller Inventory</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => window.open(api.export.download.path)} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
            {isMobile ? (
              <Button size="lg" className="h-12 px-8" onClick={() => fileInputRef.current?.click()}>
                <Camera className="w-5 h-5 mr-2" />
                Capture
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={() => batchInputRef.current?.click()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Batch Folder
                </Button>
                <Button variant="secondary">
                  <Monitor className="w-4 h-4 mr-2" />
                  Browser Pilot
                </Button>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleCapture} />
            <input type="file" ref={batchInputRef} className="hidden" multiple accept="image/*" onChange={handleBatch} />
          </div>
        </header>

        {analyzing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Analyzing...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <Card key={i} className="animate-pulse h-40" />
              ))
            ) : sortedItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group"
              >
                <Card className="overflow-hidden border-border hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5">
                  <CardContent className="p-0 flex h-44">
                    <div className="w-32 md:w-44 bg-muted relative overflow-hidden flex-shrink-0">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Camera className="w-8 h-8 opacity-20" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <Badge className={item.status === 'ACTIVE' ? 'bg-green-500' : 'bg-yellow-500'}>
                          {item.status === 'ACTIVE' ? 'ID\'d' : 'Review'}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <Input
                            className="h-8 p-0 text-lg font-bold bg-transparent border-none focus-visible:ring-0 truncate"
                            defaultValue={item.name}
                            onBlur={(e) => updateMutation.mutate({ id: item.id, updates: { name: e.target.value } })}
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMutation.mutate(item.id)}
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Brand</span>
                            <Input
                              className="h-7 text-xs bg-muted/50 border-none px-2"
                              defaultValue={item.brand || ""}
                              onBlur={(e) => updateMutation.mutate({ id: item.id, updates: { brand: e.target.value } })}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Year</span>
                            <Input
                              className="h-7 text-xs bg-muted/50 border-none px-2"
                              defaultValue={item.year || ""}
                              onBlur={(e) => updateMutation.mutate({ id: item.id, updates: { year: e.target.value } })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-1 flex-wrap mt-2 overflow-hidden max-h-6">
                        {item.vibes?.slice(0, 3).map((v, i) => (
                          <Badge key={i} variant="outline" className="text-[9px] px-1 py-0 h-4 border-muted">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {items.length === 0 && !isLoading && (
          <div className="text-center py-20 space-y-4 border-2 border-dashed border-muted rounded-xl">
            <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-xl font-medium">Inventory is empty</p>
              <p className="text-muted-foreground text-sm">Capture or upload images to start identifying items.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
