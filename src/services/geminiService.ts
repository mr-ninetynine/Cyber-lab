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

export async function* generateCyberLabResponse(prompt: string, files: AttachedFile[] = [], retryCount = 0): any {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
  }
  
  const ai = new GoogleGenAI({ apiKey });

  try {
    const parts: any[] = [{ text: prompt }];
    
    files.forEach(file => {
      parts.push({
        inlineData: {
          data: file.data,
          mimeType: file.mimeType
        }
      });
    });

    const response = await ai.models.generateContentStream({
      model: "gemini-3.1-pro-preview",
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      },
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error: any) {
    const isQuotaError = isQuotaExceeded(error);

    if (isQuotaError && retryCount < 10) {
      const delay = Math.pow(1.5, retryCount) * 1000 + Math.random() * 1000;
      console.warn(`Text Quota exceeded. Retrying in ${Math.round(delay)}ms... (Attempt ${retryCount + 1})`);
      if (retryCount === 0) yield "*(System: Uplink saturated. Initiating adaptive retry protocol...)* ";
      await new Promise(resolve => setTimeout(resolve, delay));
      yield* generateCyberLabResponse(prompt, files, retryCount + 1);
      return;
    }

    console.error("Cyber-Lab Uplink Error:", error);
    
    // Fallback to Flash model if Pro fails or quota is completely exhausted after retries
    if (error?.message?.includes("INVALID_ARGUMENT") || error?.status === "INVALID_ARGUMENT" || isQuotaError) {
      try {
        console.warn("Switching to Flash fallback model due to Pro failure/quota.");
        if (isQuotaError) yield "*(System: Pro-tier quota exhausted. Switching to high-speed Flash fallback...)* ";
        const fallbackAi = new GoogleGenAI({ apiKey });
        const fallbackResponse = await fallbackAi.models.generateContentStream({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });
        
        for await (const chunk of fallbackResponse) {
          if (chunk.text) {
            yield chunk.text;
          }
        }
      } catch (fallbackError) {
        console.error("Cyber-Lab Fallback Failed:", fallbackError);
        yield "CRITICAL ERROR: ALL UPLINKS SATURATED. SYSTEM OFFLINE.";
      }
    } else {
      yield `ERROR: ${error?.message || "UNKNOWN SYSTEM FAILURE"}`;
    }
  }
}

export async function transcribeAudio(base64Audio: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
  }
  
  const ai = new GoogleGenAI({ apiKey });

  try {
    // Using gemini-3.1-flash-lite-preview for ultra-fast transcription
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
        maxOutputTokens: 256, // Transcript should be short
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Transcription Error:", error);
    throw error;
  }
}

export async function generateSpeech(text: string, retryCount = 0): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
  }
  
  if (!text || text.trim().length === 0) {
    throw new Error("Text for speech generation is empty");
  }

  // Circuit breaker for TTS
  const now = Date.now();
  if (now - lastQuotaErrorTime < QUOTA_COOLDOWN_MS) {
    console.warn("TTS Circuit Breaker active. Skipping Gemini TTS.");
    throw new Error("TTS_QUOTA_COOLDOWN");
  }

  // Sanitize text: remove markdown and special characters that might confuse the TTS model
  const sanitizedText = text
    .replace(/[*_#`~>]/g, '') // Remove markdown symbols
    .replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say: ${sanitizedText}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            prebuiltVoiceConfig: { voiceName: 'Puck' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini TTS. The model might have returned a text response instead.");
    }
    return base64Audio;
  } catch (error: any) {
    // Handle 429 Quota Exceeded with exponential backoff
    const isQuotaError = isQuotaExceeded(error);

    if (isQuotaError) {
      lastQuotaErrorTime = Date.now(); // Activate circuit breaker
      
      if (retryCount < 10) {
        const delay = Math.pow(1.5, retryCount) * 1000 + Math.random() * 1000;
        console.warn(`TTS Quota exceeded. Retrying in ${Math.round(delay)}ms... (Attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return generateSpeech(text, retryCount + 1);
      }
    }
    
    console.error("Speech Generation Error:", error);
    throw error;
  }
}
