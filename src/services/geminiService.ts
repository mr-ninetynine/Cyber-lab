import { GoogleGenAI, Modality, ThinkingLevel, GenerateContentResponse } from "@google/genai";

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

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const geminiKey = process.env.GEMINI_API_KEY;
    const apiKey = process.env.API_KEY;
    const lKey = process.env.L_key;
    
    let keyToUse = geminiKey || apiKey || lKey;
    
    if (!keyToUse) {
      throw new Error("No API key found. Please set GEMINI_API_KEY in the Settings menu.");
    }
    
    // Clean the key: remove quotes, non-printable characters, and trim
    const cleanedKey = keyToUse.replace(/^["']|["']$/g, '').replace(/[^\x20-\x7E]/g, '').trim();
    
    if (cleanedKey.includes("TODO") || cleanedKey.includes("YOUR_API_KEY") || cleanedKey.length < 10) {
      throw new Error("API key appears to be a placeholder or invalid.");
    }
    
    aiInstance = new GoogleGenAI({ apiKey: cleanedKey });
  }
  return aiInstance;
}

export async function* generateCyberLabResponse(prompt: string, files: AttachedFile[] = []): AsyncGenerator<string> {
  console.log('Generating Cyber-Lab response for prompt:', prompt.slice(0, 50) + '...');
  try {
    const ai = getAI();
    const parts: any[] = [{ text: prompt }];
    
    if (files && files.length > 0) {
      files.forEach(file => {
        parts.push({
          inlineData: {
            data: file.data,
            mimeType: file.mimeType
          }
        });
      });
    }

    const response = await ai.models.generateContentStream({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
      },
    });

    for await (const chunk of response) {
      const c = chunk as GenerateContentResponse;
      if (c.text) {
        yield c.text;
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
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Transcription Error:", error);
    throw error;
  }
}

export async function generateSpeech(text: string): Promise<string> {
  console.log('Generating speech for text length:', text.length);
  try {
    const ai = getAI();
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
    return base64Audio;
  } catch (error) {
    console.error("Speech Generation Error:", error);
    throw error;
  }
}
