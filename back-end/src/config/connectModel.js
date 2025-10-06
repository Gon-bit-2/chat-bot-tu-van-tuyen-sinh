import { ChatOllama } from "@langchain/ollama";
import "dotenv/config";
export const ollama = new ChatOllama({
  baseUrl: process.env.URL, // || "http://localhost:11434",
  model: process.env.MODEL,
  temperature: 0.7,
});
console.log("Ollama config:", {
  baseUrl: process.env.URL,
  model: process.env.MODEL,
});
