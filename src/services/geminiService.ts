import { GoogleGenAI, Modality, ThinkingLevel } from "@google/genai";

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

export interface AttachedFile {
  data: string; // base64
  mimeType: string;
}

let lastQuotaErrorTime = 0;
const QUOTA_COOLDOWN_MS = 30000; // 30 seconds cooldown for Gemini TTS if quota hit

function isQuotaExceeded(error: any): boolean {
  if (!error) return false;
  const errStr = JSON.stringify(error).toLowerCase();
  return (
    error.status === "RESOURCE_EXHAUSTED" ||
    error.code === 429 ||
    error.error?.status === "RESOURCE_EXHAUSTED" ||
    error.error?.code === 429 ||
    errStr.includes("429") ||
    errStr.includes("quota") ||
    errStr.includes("resource_exhausted")
  );
}

function parseError(text: string, defaultMessage: string): string {
  try {
    // Helper to extract message from various error formats
    const extractMessage = (obj: any): string | null => {
      if (!obj) return null;
      
      // If it's a string, try to parse it as JSON or check for ApiError prefix
      if (typeof obj === 'string') {
        let cleaned = obj.trim();
        if (cleaned.includes('ApiError:')) {
          cleaned = cleaned.split('ApiError:')[1].trim();
        }
        
        if (cleaned.startsWith('{')) {
          try {
            return extractMessage(JSON.parse(cleaned));
          } catch (e) {
            return cleaned;
          }
        }
        return cleaned;
      }

      // If it's an object, look for common error fields
      if (typeof obj === 'object') {
        // Handle @google/genai specific nested error structure
        const errorObj = obj.error || obj;
        
        // If the error part is a string, it might be stringified JSON
        if (typeof errorObj === 'string') {
          return extractMessage(errorObj);
        }
        
        if (errorObj.message) return extractMessage(errorObj.message);
        if (errorObj.details && Array.isArray(errorObj.details)) {
          const msg = errorObj.details.find((d: any) => d.message)?.message;
          if (msg) return msg;
        }
        return errorObj.status || JSON.stringify(errorObj);
      }
      
      return String(obj);
    };

    const parsed = JSON.parse(text);
    const message = extractMessage(parsed);
    return message || defaultMessage;
  } catch (e) {
    // If top-level is not JSON, check if it contains ApiError prefix
    let cleaned = text;
    if (text.includes('ApiError:')) {
      cleaned = text.split('ApiError:')[1].trim();
      try {
        const parsed = JSON.parse(cleaned);
        const message = (parsed.error && parsed.error.message) || parsed.message || JSON.stringify(parsed);
        if (typeof message === 'string' && message.startsWith('{')) {
          try {
            const nested = JSON.parse(message);
            return (nested.error && nested.error.message) || nested.message || message;
          } catch (err) {}
        }
        return message;
      } catch (err) {
        return cleaned;
      }
    }
    return text || defaultMessage;
  }
}

export async function* generateCyberLabResponse(prompt: string, files: AttachedFile[] = [], retryCount = 0): any {
  console.log('Generating Cyber-Lab response for prompt:', prompt.slice(0, 50) + '...');
  try {
    const response = await fetch("/api/gemini/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, files }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseError(text, `Server Error (${response.status})`));
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) yield parsed.text;
          } catch (e) {
            console.error("Error parsing SSE data:", e);
          }
        }
      }
    }
  } catch (error: any) {
    console.error("Cyber-Lab Uplink Error:", error);
    throw error;
  }
}

export async function transcribeAudio(base64Audio: string, mimeType: string): Promise<string> {
  console.log('Transcribing audio with mimeType:', mimeType);
  try {
    const response = await fetch("/api/gemini/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Audio, mimeType }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseError(text, `Transcription Error (${response.status})`));
    }

    const data = await response.json();
    return data.text || "";
  } catch (error) {
    console.error("Transcription Error:", error);
    throw error;
  }
}

export async function generateSpeech(text: string): Promise<string> {
  console.log('Generating speech for text length:', text.length);
  try {
    const response = await fetch("/api/gemini/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseError(text, `TTS Error (${response.status})`));
    }

    const data = await response.json();
    return data.audio;
  } catch (error) {
    console.error("Speech Generation Error:", error);
    throw error;
  }
}
