
console.log("--- Environment Keys ---");
console.log(Object.keys(process.env).sort().join(", "));
console.log("------------------------");
console.log("GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);
console.log("API_KEY exists:", !!process.env.API_KEY);
