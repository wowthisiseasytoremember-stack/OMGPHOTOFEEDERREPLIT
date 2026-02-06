import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { chromium } from "playwright-core";

const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "dummy",
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

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
      if (!req.file) return res.status(400).json({ message: "No image provided" });

      const base64Image = req.file.buffer.toString("base64");
      const prompt = `Analyze this for a reseller. Return JSON: name, brand, edition, year, identifiers (ISBN/UPC/Issue#), vibes (5 keywords).`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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

      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) throw new Error("No response from AI");

      const data = JSON.parse(responseText);
      
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

  // --- Browser Pilot (Playwright) ---
  app.post(api.browserPilot.connect.path, async (req, res) => {
    try {
      const { wsEndpoint } = req.body;
      
      // Connect to the browser
      const browser = await chromium.connectOverCDP(wsEndpoint);
      const contexts = browser.contexts();
      const page = contexts[0]?.pages()[0]; // Grab first page of first context

      if (!page) {
        await browser.close();
        return res.status(400).json({ message: "No open pages found in browser" });
      }

      // Take screenshot
      const buffer = await page.screenshot();
      await browser.close();

      const base64Image = buffer.toString("base64");
      const prompt = `Analyze this webpage screenshot for a reseller. Identify the main item being shown. Return JSON: name, brand, edition, year, identifiers (ISBN/UPC/Issue#), vibes (5 keywords).`;

      // Analyze with Gemini
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/png", data: base64Image } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });

      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) throw new Error("No response from AI");
      const data = JSON.parse(responseText);

      // Create item immediately (Pilot flow)
      const newItem = await storage.createItem({
        name: data.name || "Web Capture",
        brand: data.brand,
        edition: data.edition,
        year: data.year,
        identifiers: typeof data.identifiers === 'object' ? JSON.stringify(data.identifiers) : data.identifiers,
        vibes: Array.isArray(data.vibes) ? data.vibes : [],
        ambientData: data,
        status: "ACTIVE",
        qty: 1
      });

      res.json({ message: "Captured successfully", items: [newItem] });

    } catch (error: any) {
      console.error("Browser pilot failed:", error);
      res.status(500).json({ message: `Browser Pilot failed: ${error.message}` });
    }
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
