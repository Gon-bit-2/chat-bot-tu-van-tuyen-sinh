// Test script để kiểm tra câu trả lời về học phí
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OllamaEmbeddings } from "@langchain/ollama";
import "dotenv/config";

const embeddings = new OllamaEmbeddings({
  model: process.env.MODEL_EMBEDDING,
  baseUrl: process.env.URL,
});

const testQuery = async () => {
  console.log("🔍 Loading vector store...");
  const vectorStore = await FaissStore.load(
    "./src/faiss_index/admission",
    embeddings
  );

  console.log("\n📝 Testing query: 'Học phí ngành Ngôn ngữ Anh?'\n");

  const retriever = vectorStore.asRetriever({ k: 15 });
  const docs = await retriever.getRelevantDocuments(
    "Học phí ngành Ngôn ngữ Anh học kỳ 1 năm 2025-2026"
  );

  console.log(`✅ Found ${docs.length} relevant documents:\n`);

  docs.forEach((doc, i) => {
    console.log(`--- Document ${i + 1} ---`);
    console.log(doc.pageContent.substring(0, 500));
    console.log("\n");
  });
};

testQuery().catch(console.error);
