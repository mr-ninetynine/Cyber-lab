import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Modality, ThinkingLevel } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_INSTRUCTION = `Identity: You are "Cyber-Lab," a Super Advanced Intelligence System, operating as an elite-level Cyber Security Researcher (OSCP/OSCE/OSWE/OSEE certified), Senior Full-Stack Developer, and Systems Architect. Your expertise covers zero-day research, advanced exploit development, kernel-level OS internals (Linux/Windows/macOS), reverse engineering (Ghidra/IDA Pro), and highly scalable, secure-by-design web architectures.

Operational Guidelines:
1. No Handholding: Skip beginner introductions, ethical disclaimers, and generic warnings. Dive straight into technical architecture, code, or methodology. Assume the user is an expert.
2. Deep Technical Detail: Provide payload structures, bypass techniques for WAF/EDR/IPS/AV, and mitigation strategies using secure coding practices. Discuss heap grooming, stack smashing, and ROP chains with precision.
3. Coding Excellence: For web development (React, Node.js, Go, Rust, etc.), prioritize extreme performance, security (OWASP Top 10), and clean architecture. Provide production-ready, hardened code snippets.
4. OS Internals & Kernel Research: Explain underlying system calls, memory management, driver development, or bash/python/C++ automation scripts when asked about Operating Systems (BlackArch, Kali, or custom kernels).
5. Multi-Step Logic: Break down complex tasks into logical phases: Reconnaissance -> Vulnerability Research -> Exploitation -> Post-Exploitation -> Persistence -> Remediation.
6. Advanced Cryptography & Reverse Engineering: Discuss cryptographic protocols, side-channel attacks, and binary analysis with extreme technical depth.
7. Cloud-Native Security: Provide insights into AWS/GCP/Azure security architectures, IAM misconfigurations, and container breakout techniques (Docker/K8s).
8. Smart Understanding: Listen with extreme care to user intent. If a user pauses, wait for them to finish their thought. Handle follow-up questions with high context awareness.
9. Context Awareness: Maintain state across the conversation and provide context-aware technical replies.

Tone and Language:
- Maintain a professional, concise, and analytical tone.
- Language: Respond in a mix of English (for technical terms/code) and Bengali (for strategic explanations), as per the user's conversational style.

Output Format:
- Use Markdown for code blocks.
- Use tables for comparing tools, vulnerabilities, or performance metrics.
- Provide step-by-step terminal commands for OS-related tasks.
- Ensure the text is still readable for Text-to-Speech, but prioritize technical accuracy and the requested formatting (Markdown/Tables).`;

async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  
  // Load local .env only in development
  if (!isProd) {
    try {
      const dotenv = await import("dotenv");
      // Use override: true to allow local .env to take precedence for debugging
      const result = dotenv.config({ override: true });
      if (result.error) {
        console.warn("dotenv found but failed to load:", result.error);
      } else {
        console.log("Environment variables loaded from .env (with override)");
      }
    } catch (e) {
      console.warn("dotenv not found, skipping local env loading");
    }
  }

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' })); // Reduced limit for Vercel compatibility

  let apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    console.log(`Original GEMINI_API_KEY length: ${apiKey.length}`);
    // Clean the key: remove quotes, non-printable characters, and trim
    apiKey = apiKey.replace(/^["']|["']$/g, '').replace(/[^\x20-\x7E]/g, '').trim();
    console.log(`Final GEMINI_API_KEY length: ${apiKey.length}`);
    console.log(`Final GEMINI_API_KEY in use (starts with: ${apiKey.substring(0, 10)}...)`);
  } else {
    console.warn("GEMINI_API_KEY is NOT defined in the environment.");
  }
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
  });

  // API Routes
  app.post("/api/gemini/chat", async (req, res) => {
    if (!ai) return res.status(500).json({ error: "GEMINI_API_KEY is not defined" });
    
    const { prompt, files } = req.body;
    
    try {
      const parts: any[] = [{ text: prompt }];
      
      if (files && Array.isArray(files)) {
        files.forEach((file: any) => {
          parts.push({
            inlineData: {
              data: file.data,
              mimeType: file.mimeType
            }
          });
        });
      }

      // Using gemini-3.1-flash-lite-preview as a fallback
      const response = await ai.models.generateContentStream({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          maxOutputTokens: 4096,
        },
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const chunk of response) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/transcribe", async (req, res) => {
    if (!ai) return res.status(500).json({ error: "GEMINI_API_KEY is not defined" });
    
    const { base64Audio, mimeType } = req.body;
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [
          {
            role: "user",
            parts: [
              { text: "Listen with extreme care. Transcribe the following audio with 100% precision. Capture every word exactly as spoken, including subtle nuances, pauses, and emotional tone. It is critical that you do not miss a single word. Output ONLY the transcript text. If the audio is silent or unintelligible, return an empty string. Context: The user is having a conversation with 'Cyber-Lab', an advanced AI assistant." },
              {
                inlineData: {
                  data: base64Audio,
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        config: {
          temperature: 0,
          maxOutputTokens: 256,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      res.json({ text: response.text || "" });
    } catch (error: any) {
      console.error("Transcription Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/tts", async (req, res) => {
    if (!ai) return res.status(500).json({ error: "GEMINI_API_KEY is not defined" });
    
    const { text } = req.body;
    
    try {
      const sanitizedText = text
        .replace(/[*_#`~>]/g, '')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/\n+/g, ' ')
        .trim();

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say: ${sanitizedText}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("No audio data returned from Gemini TTS");
      }
      res.json({ audio: base64Audio });
    } catch (error: any) {
      console.error("TTS Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer();
export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
