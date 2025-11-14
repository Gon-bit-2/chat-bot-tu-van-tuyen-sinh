import { ChatOllama } from "@langchain/ollama";
import "dotenv/config";

// Tối ưu hóa cấu hình cho tốc độ phản hồi nhanh hơn
export const ollama = new ChatOllama({
  baseUrl: process.env.URL,
  model: process.env.MODEL,
  temperature: 0.3, // Tăng nhẹ để response tự nhiên hơn nhưng vẫn chính xác
  // Giới hạn độ dài output để giảm thời gian generation
  maxTokens: 512, // Giới hạn 512 tokens cho response nhanh
  topP: 0.9, // Top-p sampling để cải thiện tốc độ
  numCtx: 2048, // Giảm context window để xử lý nhanh hơn
});

console.log("Ollama config (Optimized):", {
  baseUrl: process.env.URL,
  model: process.env.MODEL,
  maxTokens: 512,
  temperature: 0.3,
  topP: 0.9,
});
