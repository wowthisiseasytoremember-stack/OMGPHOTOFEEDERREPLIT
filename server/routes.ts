import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
// Playwright removed - too heavy for serverless, causes startup timeouts

const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini - use GOOGLE_API_KEY for production
const apiKey = process.env.GOOGLE_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
if (!apiKey) {
  console.warn("Warning: No Gemini API key found. AI analysis will not work.");
} else {
  console.log("Gemini API key configured successfully");
}

const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // --- Items CRUD ---
  app.get(api.items.list.path, async (req, res) => {
    const items = await storage.getItems();
    res.json(items);
  });

  app.get(api.items.get.path, async (req, res) => {
    const item = await storage.getItem(Number(req.params.id));
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  });

  app.post(api.items.create.path, async (req, res) => {
    try {
      const input = api.items.create.input.parse(req.body);
      const item = await storage.createItem(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.items.update.path, async (req, res) => {
    try {
      const input = api.items.update.input.parse(req.body);
      const item = await storage.updateItem(Number(req.params.id), input);
      res.json(item);
    } catch (err) {
      res.status(400).json({ message: "Update failed" });
    }
  });

  app.delete(api.items.delete.path, async (req, res) => {
    await storage.deleteItem(Number(req.params.id));
    res.status(204).send();
  });

  // --- Analysis (Gemini) ---
  app.post(api.analyze.upload.path, upload.single("image"), async (req, res) => {
    try {
      if (!genAI) {
        return res.status(500).json({ message: "AI not configured - missing API key" });
      }
      
      if (!req.file) return res.status(400).json({ message: "No image provided" });

      const base64Image = req.file.buffer.toString("base64");
      const prompt = `Analyze this item for a reseller. Return JSON with these fields: name, brand, edition, year, identifiers (ISBN/UPC/Issue#), vibes (5 keywords). Be concise.`;

      // Use gemini-1.5-flash model
      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: req.file.mimetype, data: base64Image } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });

      const responseText = result.text;
      if (!responseText) throw new Error("No response from AI");

      // Parse JSON response
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[1].trim());
        } else {
          throw new Error("Could not parse AI response as JSON");
        }
      }

      // Normalize AI response to our schema expectations
      // AI might return "identifiers": "ISBN 123" or object. 
      // We want flat strings for the main fields if possible.
      const normalized = {
        name: data.name || "Unknown Item",
        brand: data.brand,
        edition: data.edition,
        year: data.year,
        identifiers: typeof data.identifiers === 'object' ? JSON.stringify(data.identifiers) : data.identifiers,
        vibes: Array.isArray(data.vibes) ? data.vibes : [],
        ambientData: data // Store full raw data too
      };

      res.json(normalized);
    } catch (error) {
      console.error("Analysis failed:", error);
      res.status(500).json({ message: "Analysis failed" });
    }
  });

  // --- Browser Pilot (Disabled - Playwright too heavy for serverless) ---
  app.post(api.browserPilot.connect.path, async (req, res) => {
    res.status(501).json({ 
      message: "Browser Pilot is not available in production. Use batch upload instead." 
    });
  });

  // --- Export ---
  app.get(api.export.download.path, async (req, res) => {
    const items = await storage.getItems();
    const exportData = items.map(item => ({
      name: item.name,
      qty: item.qty,
      status: item.status,
      addedAt: item.addedAt?.toISOString(),
      ambient_data: {
        ...item.ambientData as object,
        ai_confidence: 1.0, // Mock, or real if we had it
        year: item.year,
        edition: item.edition,
        vibes: item.vibes
      }
    }));
    
    res.setHeader('Content-Disposition', 'attachment; filename="final_import.json"');
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(exportData, null, 2));
  });

  return httpServer;
}
