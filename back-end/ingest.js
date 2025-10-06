// file: ingest.js
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OllamaEmbeddings } from "@langchain/ollama";
import "dotenv/config";

// 1. Khai báo các đường dẫn
const dataPath = "./src/data/vhu"; // Thư mục chứa tài liệu
const faissStorePath = "./src/faiss_index/vhu"; // Nơi lưu trữ "thư viện số"

// 2. Cấu hình model để "số hóa" văn bản (Embedding)
// Dùng chung model với file connectModel để tiết kiệm tài nguyên
const embeddings = new OllamaEmbeddings({
  model: process.env.MODEL_EMBEDDING,
  baseUrl: process.env.URL,
});

// 3. Hàm chính để thực thi
const runIngestion = async () => {
  try {
    console.log("Bắt đầu quá trình nạp dữ liệu...");

    // Tải tất cả các file từ thư mục `data`
    const loader = new DirectoryLoader(dataPath, {
      ".pdf": (path) => new PDFLoader(path),
      ".txt": (path) => new TextLoader(path),
    });
    const docs = await loader.load();
    console.log(`Đã tải thành công ${docs.length} tài liệu.`);

    // Chia nhỏ các tài liệu thành các đoạn văn bản (chunk)
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log(`Đã chia thành ${splitDocs.length} đoạn văn bản.`);

    // Số hóa và lưu trữ vào FAISS index
    console.log("Bắt đầu tạo và lưu trữ vector store (thư viện số)...");
    const vectorStore = await FaissStore.fromDocuments(splitDocs, embeddings);
    await vectorStore.save(faissStorePath);

    console.log(
      `🎉 Đã tạo và lưu trữ thư viện số thành công tại: ${faissStorePath}`
    );
  } catch (error) {
    console.error("Đã xảy ra lỗi trong quá trình nạp dữ liệu:", error);
  }
};

runIngestion();
