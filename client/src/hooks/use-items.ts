import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertItem, Item } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// GET /api/items
export function useItems() {
  return useQuery({
    queryKey: [api.items.list.path],
    queryFn: async () => {
      const res = await fetch(api.items.list.path);
      if (!res.ok) throw new Error("Failed to fetch items");
      return api.items.list.responses[200].parse(await res.json());
    },
  });
}

// POST /api/items (Manual Create)
export function useCreateItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: InsertItem) => {
      const validated = api.items.create.input.parse(data);
      const res = await fetch(api.items.create.path, {
        method: api.items.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      });
      if (!res.ok) throw new Error("Failed to create item");
      return api.items.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      toast({ title: "Success", description: "Item created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

// PUT /api/items/:id
export function useUpdateItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertItem>) => {
      const validated = api.items.update.input.parse(updates);
      const url = buildUrl(api.items.update.path, { id });
      const res = await fetch(url, {
        method: api.items.update.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      });
      if (!res.ok) throw new Error("Failed to update item");
      return api.items.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      toast({ title: "Updated", description: "Item changes saved" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

// DELETE /api/items/:id
export function useDeleteItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.items.delete.path, { id });
      const res = await fetch(url, { method: api.items.delete.method });
      if (!res.ok) throw new Error("Failed to delete item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      toast({ title: "Deleted", description: "Item removed from database" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

// POST /api/analyze/upload
// Note: This endpoint processes the image and likely creates the item on the backend
export function useAnalyzeImage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      const res = await fetch(api.analyze.upload.path, {
        method: api.analyze.upload.method,
        body: formData,
        // No Content-Type header - browser sets multipart boundary
      });
      
      if (!res.ok) throw new Error("Analysis failed");
      return api.analyze.upload.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      // Assuming backend auto-saves, we invalidate list. 
      // If it just returns data, we might need to call createItem here.
      // Based on prompt "Store results in SQLite... immediately", we assume backend persistence.
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      toast({ 
        title: "Analysis Complete", 
        description: `Identified: ${data.name} (${data.ai_confidence ? Math.round(data.ai_confidence * 100) + '%' : 'AI'})` 
      });
    },
    onError: (error) => {
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
    }
  });
}

// POST /api/browser-pilot
export function useBrowserPilot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (wsEndpoint: string) => {
      const res = await fetch(api.browserPilot.connect.path, {
        method: api.browserPilot.connect.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wsEndpoint }),
      });
      if (!res.ok) throw new Error("Browser Pilot connection failed");
      return api.browserPilot.connect.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      toast({ title: "Pilot Active", description: `Scanned ${data.items.length} items from browser tabs` });
    },
    onError: (error) => {
      toast({ title: "Pilot Error", description: error.message, variant: "destructive" });
    }
  });
}
