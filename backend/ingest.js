// file: ingest.js
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OllamaEmbeddings } from "@langchain/ollama";
import "dotenv/config";

// 1. Cấu hình các mode khác nhau
const MODES = {
  admission: {
    dataPath: "./src/data/admission",
    faissPath: "./src/faiss_index/admission",
    description: "Tư vấn tuyển sinh",
  },
  "student-support": {
    dataPath: "./src/data/student-support",
    faissPath: "./src/faiss_index/student-support",
    description: "Hỗ trợ sinh viên",
  },
};

// 2. Cấu hình model để "số hóa" văn bản (Embedding)
const embeddings = new OllamaEmbeddings({
  model: process.env.MODEL_EMBEDDING,
  baseUrl: process.env.URL,
});

// 3. Hàm nạp dữ liệu cho một mode cụ thể
const runIngestionForMode = async (mode) => {
  const config = MODES[mode];
  if (!config) {
    console.error(`❌ Mode không hợp lệ: ${mode}`);
    console.log(`Các mode hợp lệ: ${Object.keys(MODES).join(", ")}`);
    return;
  }

  try {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🚀 Bắt đầu nạp dữ liệu cho mode: ${mode}`);
    console.log(`📝 Mô tả: ${config.description}`);
    console.log(`📂 Thư mục dữ liệu: ${config.dataPath}`);
    console.log(`💾 Thư mục lưu trữ: ${config.faissPath}`);
    console.log(`${"=".repeat(60)}\n`);

    // Tải tất cả các file từ thư mục data
    const loader = new DirectoryLoader(config.dataPath, {
      ".pdf": (path) => new PDFLoader(path),
      ".txt": (path) => new TextLoader(path),
    });
    const docs = await loader.load();
    console.log(`✅ Đã tải thành công ${docs.length} tài liệu.`);

    if (docs.length === 0) {
      console.warn(`⚠️  Không tìm thấy tài liệu nào trong ${config.dataPath}`);
      console.log(
        `💡 Hãy thêm file .txt hoặc .pdf vào thư mục này trước khi chạy lại.`
      );
      return;
    }

    // Chia nhỏ các tài liệu thành các đoạn văn bản (chunk)
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log(`✅ Đã chia thành ${splitDocs.length} đoạn văn bản.`);

    // Số hóa và lưu trữ vào FAISS index
    console.log("⏳ Bắt đầu tạo và lưu trữ vector store...");
    const vectorStore = await FaissStore.fromDocuments(splitDocs, embeddings);
    await vectorStore.save(config.faissPath);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🎉 Thành công! Mode: ${mode}`);
    console.log(`📍 Đã lưu tại: ${config.faissPath}`);
    console.log(`📊 Tổng số tài liệu: ${docs.length}`);
    console.log(`📊 Tổng số đoạn văn: ${splitDocs.length}`);
    console.log(`${"=".repeat(60)}\n`);
  } catch (error) {
    console.error(`❌ Lỗi khi nạp dữ liệu cho mode ${mode}:`, error);
  }
};

// 4. Hàm chính để thực thi
const runIngestion = async () => {
  // Lấy mode từ command line argument
  const args = process.argv.slice(2);
  const modeIndex = args.indexOf("--mode");
  let mode = modeIndex !== -1 ? args[modeIndex + 1] : null;

  if (!mode) {
    console.log("\n📋 Chưa chỉ định mode. Các tùy chọn:\n");
    console.log("1️⃣  node ingest.js --mode admission");
    console.log("    → Tạo FAISS index cho tư vấn tuyển sinh\n");
    console.log("2️⃣  node ingest.js --mode student-support");
    console.log("    → Tạo FAISS index cho hỗ trợ sinh viên\n");
    console.log("3️⃣  node ingest.js --mode all");
    console.log("    → Tạo FAISS index cho tất cả các mode\n");

    // Mặc định chạy mode admission
    console.log("⚠️  Đang chạy mode mặc định: admission\n");
    mode = "admission";
  }

  if (mode === "all") {
    console.log("🔄 Chạy tất cả các mode...\n");
    for (const modeName of Object.keys(MODES)) {
      await runIngestionForMode(modeName);
    }
    console.log("\n✅ Đã hoàn thành tất cả các mode!");
  } else {
    await runIngestionForMode(mode);
  }
};

runIngestion();
