import { ChatOllama } from "@langchain/ollama";
import "dotenv/config";
export const ollama = new ChatOllama({
  baseUrl: process.env.URL,
  model: process.env.MODEL,
  temperature: 0, // Temperature = 0 để model tập trung vào dữ liệu, không tự sáng tạo
});
console.log("Ollama config:", {
  baseUrl: process.env.URL,
  model: process.env.MODEL,
});
