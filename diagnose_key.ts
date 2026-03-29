
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function diagnose() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const apiKey = process.env.API_KEY;
  const lKey = process.env.L_key;
  
  console.log("--- API Key Diagnosis ---");
  console.log("GEMINI_API_KEY found:", !!geminiKey);
  console.log("API_KEY found:", !!apiKey);
  console.log("L_key found:", !!lKey);
  
  const keyToUse = geminiKey || apiKey || lKey;
  if (!keyToUse) {
    console.log("RESULT: No API key found in environment variables.");
    return;
  }
  
  const cleanedKey = keyToUse.replace(/^["']|["']$/g, '').replace(/[^\x20-\x7E]/g, '').trim();
  console.log("Cleaned key length:", cleanedKey.length);
  
  try {
    console.log("Attempting test call to Gemini...");
    const ai = new GoogleGenAI({ apiKey: cleanedKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "hi",
    });
    console.log("RESULT: Success! The API key is working correctly.");
    console.log("Response preview:", response.text?.substring(0, 50));
  } catch (error: any) {
    console.log("RESULT: Failed.");
    console.log("Error Name:", error.name);
    console.log("Error Message:", error.message);
    
    if (error.message.includes("API_KEY_INVALID") || error.message.includes("API key not valid")) {
      console.log("DIAGNOSIS: The API key is explicitly rejected by Google as invalid.");
    } else if (error.message.includes("429") || error.message.includes("quota")) {
      console.log("DIAGNOSIS: You have hit a rate limit or quota limit.");
    } else if (error.message.includes("403") || error.message.includes("permission")) {
      console.log("DIAGNOSIS: Permission denied. The key might be restricted or the model is not enabled.");
    } else {
      console.log("DIAGNOSIS: Unknown error. Check the message above.");
    }
  }
}

diagnose();
