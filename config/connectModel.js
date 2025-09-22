import { ChatOllama } from "@langchain/ollama";
import "dotenv/config";
export const ollama = new ChatOllama({
  baseUrl: "http://localhost:11434",
  model: "gemma:2b",
  temperature: 0.7,
});
