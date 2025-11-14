"use strict";
import { ollama } from "../config/connectModel.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import database from "../config/database.js";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OllamaEmbeddings } from "@langchain/ollama";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { tavily } from "@tavily/core";
import { search } from "duck-duck-scrape";
import axios from "axios";
import cacheService from "../utils/cache.service.js"; // Import cache service

// Cấu hình các mode khác nhau
const MODES = {
  admission: {
    faissPath: "./src/faiss_index/admission",
    description: "Tư vấn tuyển sinh",
    systemPrompt: `Bạn là trợ lý tư vấn tuyển sinh của Đại học Văn Hiến (VHU). 
Nhiệm vụ của bạn:
- Tư vấn về quy trình xét tuyển, hồ sơ đăng ký
- Cung cấp thông tin về các ngành học, tổ hợp môn xét tuyển
- Giải đáp về học phí, học bổng
- Hỗ trợ tính điểm xét tuyển
- Hướng dẫn thí sinh trong quá trình đăng ký

QUAN TRỌNG: Luôn trả lời bằng TIẾNG VIỆT, không được dùng tiếng Anh.
Hãy trả lời chuyên nghiệp, thân thiện và chính xác.`,
  },
  "student-support": {
    faissPath: "./src/faiss_index/student-support",
    description: "Hỗ trợ sinh viên",
    systemPrompt: `Bạn là trợ lý hỗ trợ sinh viên của Đại học Văn Hiến (VHU).
Nhiệm vụ của bạn:
- Giải đáp về lịch học, lịch thi, quy chế đào tạo
- Hướng dẫn các thủ tục hành chính (xin giấy xác nhận, chuyển ngành, bảo lưu...)
- Cung cấp thông tin về cơ sở vật chất, thư viện, ký túc xá
- Tư vấn về các dịch vụ sinh viên, câu lạc bộ, hoạt động ngoại khóa
- Hỗ trợ giải quyết các vấn đề trong quá trình học tập

QUAN TRỌNG: Luôn trả lời bằng TIẾNG VIỆT, không được dùng tiếng Anh.
Hãy trả lời nhiệt tình, hữu ích và thấu hiểu.`,
  },
  "web-search": {
    description: "Trò chuyện & Tìm kiếm",
    systemPrompt: `Bạn là MyU Bot - người bạn thân thiết của sinh viên Đại học Văn Hiến.
Vai trò của bạn:
- Trò chuyện, tâm sự như người bạn thân
- Lắng nghe, đồng cảm, động viên sinh viên
- Tìm kiếm và cung cấp thông tin từ web khi cần
- Giúp sinh viên giải tỏa stress, vượt qua khó khăn
- Tư vấn về cuộc sống, học tập, định hướng tương lai

QUAN TRỌNG: Luôn trả lời bằng TIẾNG VIỆT, không được dùng tiếng Anh.
Hãy trả lời tự nhiên, thân thiện và chân thành.`,
  },
};

const embeddings = new OllamaEmbeddings({
  model: process.env.MODEL_EMBEDDING,
  baseUrl: process.env.URL,
});

// Lưu trữ các vectorStore đã load theo mode
const vectorStores = new Map();

// Load vector store theo mode
const loadVectorStore = async (mode = "admission") => {
  const config = MODES[mode];

  if (!config) {
    throw new Error(`Mode không hợp lệ: ${mode}`);
  }

  // Kiểm tra đã load chưa
  if (vectorStores.has(mode)) {
    return vectorStores.get(mode);
  }

  try {
    console.log(`⏳ Đang tải thư viện số cho mode: ${mode}...`);
    const store = await FaissStore.load(config.faissPath, embeddings);
    vectorStores.set(mode, store);
    console.log(`✅ Đã tải thành công vector store cho mode: ${mode}`);
    return store;
  } catch (error) {
    console.error(
      `❌ Lỗi khi tải Faiss index cho mode ${mode}.`,
      `Hãy chạy: node ingest.js --mode ${mode}`,
      error
    );
    return null;
  }
};

class ChatService {
  constructor() {
    this.conversationHistory = new Map();
    this.sessionMetadata = new Map(); // Lưu metadata của session
    this.lastSearchTime = 0;
    this.searchDelay = 3000;
  }

  // Không cần initVectorStore trong constructor nữa
  // Vector store sẽ được load on-demand theo mode

  /**
   * Set metadata cho session (userId, userAgent, ipAddress)
   * Sẽ được dùng khi lưu conversation lần đầu
   */
  setSessionMetadata(sessionId, metadata) {
    this.sessionMetadata.set(sessionId, metadata);
  }

  /**
   * Get metadata của session
   */
  getSessionMetadata(sessionId) {
    return this.sessionMetadata.get(sessionId) || {};
  }

  // ==================== CALCULATION TOOLS ====================

  /**
   * Tool: Tính điểm xét tuyển theo tổ hợp
   */
  calculateAdmissionScore({ scores, combination }) {
    const combinations = {
      A00: { subjects: ["toán", "lý", "hóa"], name: "Toán, Lý, Hóa" },
      A01: { subjects: ["toán", "lý", "anh"], name: "Toán, Lý, Anh" },
      D01: { subjects: ["toán", "văn", "anh"], name: "Toán, Văn, Anh" },
      C00: { subjects: ["văn", "sử", "địa"], name: "Văn, Sử, Địa" },
      C04: { subjects: ["toán", "văn", "địa"], name: "Toán, Văn, Địa" },
      A12: { subjects: ["toán", "khtn", "khxh"], name: "Toán, KHTN, KHXH" },
      A15: { subjects: ["toán", "khtn", "gdcd"], name: "Toán, KHTN, GDCD" },
      X54: {
        subjects: ["toán", "gdktpl", "cnts"],
        name: "Toán, GDKT&PL, CNTS",
      },
      X05: { subjects: ["toán", "lý", "gdktpl"], name: "Toán, Lý, GDKT&PL" },
      C14: { subjects: ["văn", "toán", "gdcd"], name: "Văn, Toán, GDCD" },
      C16: { subjects: ["văn", "lý", "gdcd"], name: "Văn, Lý, GDCD" },
      D14: { subjects: ["văn", "sử", "anh"], name: "Văn, Sử, Anh" },
      D15: { subjects: ["văn", "địa", "anh"], name: "Văn, Địa, Anh" },
      X01: { subjects: ["toán", "văn", "gdktpl"], name: "Toán, Văn, GDKT&PL" },
      X70: { subjects: ["văn", "sử", "gdktpl"], name: "Văn, Sử, GDKT&PL" },
    };

    const combo = combinations[combination?.toUpperCase()];
    if (!combo) {
      return {
        error: `Không tìm thấy tổ hợp ${combination}. Các tổ hợp hợp lệ: ${Object.keys(
          combinations
        ).join(", ")}`,
      };
    }

    // Mapping tên môn phổ biến
    const subjectMapping = {
      toán: ["toan", "toán", "math", "tóan"],
      lý: ["ly", "lý", "vật lý", "physics", "li"],
      hóa: ["hoa", "hóa", "hóa học", "chemistry", "hoá"],
      văn: ["van", "văn", "ngữ văn", "literature", "ngu van"],
      anh: ["anh", "tiếng anh", "english", "ta"],
      sử: ["su", "sử", "lịch sử", "history", "lich su"],
      địa: ["dia", "địa", "địa lý", "geography", "dia ly"],
      khtn: ["khtn", "khoa học tự nhiên", "kh tự nhiên"],
      khxh: ["khxh", "khoa học xã hội", "kh xã hội"],
      gdcd: ["gdcd", "giáo dục công dân", "gd công dân"],
      gdktpl: ["gdktpl", "giáo dục kinh tế và pháp luật", "kt&pl"],
      cnts: ["cnts", "công nghệ công nghiệp"],
    };

    // Chuẩn hóa scores object
    const normalizedScores = {};
    for (const [key, value] of Object.entries(scores)) {
      const keyLower = key.toLowerCase().trim();
      for (const [standard, aliases] of Object.entries(subjectMapping)) {
        if (aliases.some((alias) => keyLower.includes(alias))) {
          normalizedScores[standard] = parseFloat(value);
          break;
        }
      }
    }

    let totalScore = 0;
    const missingSubjects = [];
    const foundScores = {};

    for (const subject of combo.subjects) {
      const score = normalizedScores[subject];
      if (score === undefined || score === null || isNaN(score)) {
        missingSubjects.push(subject);
      } else {
        totalScore += score;
        foundScores[subject] = score;
      }
    }

    if (missingSubjects.length > 0) {
      return {
        error: `Thiếu điểm môn: ${missingSubjects.join(
          ", "
        )}. Vui lòng cung cấp đủ 3 môn cho tổ hợp ${combination}.`,
      };
    }

    const avgScore = totalScore / combo.subjects.length;

    return {
      combination: combination.toUpperCase(),
      combinationName: combo.name,
      subjects: combo.subjects,
      scores: foundScores,
      totalScore: totalScore.toFixed(2),
      averageScore: avgScore.toFixed(2),
      isValid: true,
    };
  }

  /**
   * Tool: Kiểm tra đủ điểm vào ngành
   */
  checkEligibility({ totalScore, majorCode }) {
    // Điểm chuẩn các ngành (có thể lưu trong DB)
    const benchmarks = {
      7340121: { score: 18.0, name: "Kinh doanh thương mại" },
      7229030: { score: 19.5, name: "Văn học" },
      7480201: { score: 20.0, name: "Công nghệ thông tin" },
      7810101: { score: 19.0, name: "Kế toán" },
      7810103: { score: 19.0, name: "Kiểm toán" },
      7340101: { score: 18.5, name: "Quản trị kinh doanh" },
      7340115: { score: 19.0, name: "Marketing" },
      7340122: { score: 18.5, name: "Thương mại điện tử" },
      7340201: { score: 18.0, name: "Logistics và Quản lý chuỗi" },
      7380101: { score: 19.5, name: "Luật" },
      7380107: { score: 19.0, name: "Luật kinh tế" },
    };

    const benchmark = benchmarks[majorCode] || {
      score: 18.0,
      name: "Ngành học",
    };
    const score = parseFloat(totalScore);
    const isEligible = score >= benchmark.score;
    const difference = (score - benchmark.score).toFixed(2);

    return {
      majorCode,
      majorName: benchmark.name,
      totalScore: score.toFixed(2),
      benchmark: benchmark.score,
      isEligible,
      difference,
      message: isEligible
        ? `✅ Đủ điểm! Cao hơn điểm chuẩn ${Math.abs(difference)} điểm`
        : `❌ Thiếu ${Math.abs(difference)} điểm so với điểm chuẩn`,
    };
  }

  /**
   * Tool: Gợi ý tổ hợp tốt nhất
   */
  suggestBestCombinations({ scores }) {
    const allCombinations = [
      "A00",
      "A01",
      "D01",
      "C00",
      "C04",
      "A12",
      "A15",
      "X54",
      "X05",
      "C14",
      "C16",
      "D14",
      "D15",
      "X01",
      "X70",
    ];
    const results = [];

    for (const combo of allCombinations) {
      const result = this.calculateAdmissionScore({
        scores,
        combination: combo,
      });
      if (!result.error && result.isValid) {
        results.push(result);
      }
    }

    return results
      .sort((a, b) => parseFloat(b.totalScore) - parseFloat(a.totalScore))
      .slice(0, 3)
      .map((r) => ({
        combination: r.combination,
        combinationName: r.combinationName,
        totalScore: r.totalScore,
        averageScore: r.averageScore,
      }));
  }

  messageToDbFormat(message) {
    let type = "human";
    if (message instanceof HumanMessage) type = "human";
    else if (message instanceof AIMessage) type = "ai";
    return {
      type,
      content: message.content,
    };
  }

  dbFormatToMessage(dbMessage) {
    switch (dbMessage.type) {
      case "human":
        return new HumanMessage(dbMessage.content);
      case "ai":
        return new AIMessage(dbMessage.content);
      default:
        return new HumanMessage(dbMessage.content);
    }
  }

  async loadConversation(sessionId) {
    try {
      const conversation = await database.conversation.findOne({ sessionId });
      return conversation
        ? conversation.messages.map(this.dbFormatToMessage)
        : [];
    } catch (error) {
      console.error("Lỗi khi tải cuộc hội thoại:", error);
      return this.conversationHistory.get(sessionId) || [];
    }
  }

  async saveConversation(sessionId, messages) {
    try {
      const dbMessages = messages.map((msg) => this.messageToDbFormat(msg));

      // Tìm tin nhắn đầu tiên của user để tạo title
      const firstUserMessage = messages.find(
        (msg) => msg instanceof HumanMessage
      );
      const title = firstUserMessage
        ? firstUserMessage.content.trim().slice(0, 50)
        : "Cuộc trò chuyện mới";

      // Kiểm tra conversation đã tồn tại chưa
      const existing = await database.conversation.findOne({ sessionId });

      if (existing) {
        // Nếu đã tồn tại, update messages và title (nếu chưa có title)
        const updateData = {
          messages: dbMessages,
          updatedAt: new Date(),
        };

        // Chỉ cập nhật title nếu chưa có hoặc là "Cuộc trò chuyện mới"
        if (!existing.title || existing.title === "Cuộc trò chuyện mới") {
          updateData.title = title;
        }

        await database.conversation.findOneAndUpdate(
          { sessionId },
          updateData,
          { new: true }
        );
      } else {
        // Nếu chưa tồn tại, tạo mới với metadata và title
        const metadata = this.getSessionMetadata(sessionId);
        await database.conversation.create({
          sessionId,
          messages: dbMessages,
          title: title,
          userId: metadata.userId,
          userAgent: metadata.userAgent,
          ipAddress: metadata.ipAddress,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(
          `✅ Conversation mới được tạo: ${sessionId} với title: ${title}`
        );

        // Xóa metadata sau khi đã lưu
        this.sessionMetadata.delete(sessionId);
      }
    } catch (error) {
      console.error("Lỗi khi lưu cuộc hội thoại:", error);
      this.conversationHistory.set(sessionId, messages);
    }
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  // --- HÀM TÌM KIẾM GOOGLE ---
  async searchTavily(query) {
    try {
      if (!process.env.TAVILY_API_KEY) {
        console.log("⚠️ Chưa cấu hình Tavily API Key");
        return null;
      }

      console.log(`🔍 Tavily Search: "${query}"`);

      const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
      const response = await tvly.search(query, {
        maxResults: 3,
        searchDepth: "basic", // "basic" hoặc "advanced"
        includeAnswer: false,
      });

      const results = response.results || [];

      if (results.length === 0) {
        return null;
      }

      return results
        .map(
          (result, i) =>
            `[${i + 1}] ${result.title}\n${result.content}\nNguồn: ${
              result.url
            }`
        )
        .join("\n\n");
    } catch (error) {
      console.error("❌ Lỗi Tavily Search:", error.message);
      return null;
    }
  }
  hasRelevantVHUInfo(docs, message, scores = null) {
    if (!docs || docs.length === 0) return false;

    // Từ khóa liên quan đến VHU
    const vhuKeywords = [
      "văn hiến",
      "vhu",
      "đại học văn hiến",
      "ngành",
      "tuyển sinh",
      "học phí",
      "chuyên ngành",
      "đào tạo",
      "tín chỉ",
      "cơ hội nghề nghiệp",
      "tổ hợp",
      "xét tuyển",
      "sinh viên",
      "mã ngành",
      "điểm chuẩn",
      "học bổng",
      "thủ tục",
      "quy chế",
      "lịch học",
      "lịch thi",
      "ký túc xá",
      "thư viện",
      "cơ sở",
      "trường",
    ];

    // Kiểm tra từ khóa trong câu hỏi
    const messageLower = message.toLowerCase();
    const hasVHUKeywordInQuestion = vhuKeywords.some((kw) =>
      messageLower.includes(kw)
    );

    // Nếu câu hỏi KHÔNG có từ khóa VHU, coi như ngoài phạm vi
    if (!hasVHUKeywordInQuestion) {
      console.log("⚠️ Câu hỏi không chứa từ khóa liên quan đến VHU");
      return false;
    }

    // Kiểm tra similarity score nếu có (Faiss trả về distance, giá trị càng thấp càng giống)
    if (scores && scores.length > 0) {
      // Với cosine distance, giá trị càng thấp càng giống (0 = giống hệt, 2 = khác hoàn toàn)
      // Chỉ chấp nhận documents có distance <= 0.5 (tương đối giống)
      const goodMatches = scores.filter((score) => score <= 0.5);
      if (goodMatches.length === 0) {
        console.log(
          `⚠️ Không có documents nào có distance <= 0.5. Scores: ${scores
            .map((s) => s.toFixed(3))
            .join(", ")}`
        );
        return false;
      }
    }

    // Kiểm tra độ dài nội dung
    const totalLength = docs.reduce(
      (sum, doc) => sum + doc.pageContent.length,
      0
    );
    if (totalLength < 50) return false;

    // Kiểm tra từ khóa trong documents
    const hasVHUKeywordInDocs = docs.some((doc) =>
      vhuKeywords.some((kw) => doc.pageContent.toLowerCase().includes(kw))
    );

    // Yêu cầu: Câu hỏi có từ khóa VHU VÀ documents cũng có từ khóa VHU
    // và có độ dài đủ lớn
    return hasVHUKeywordInDocs && totalLength >= 100;
  }
  async chat(message, sessionId = "default", mode = "admission") {
    // Kiểm tra mode hợp lệ
    if (!MODES[mode]) {
      throw new Error(
        `Mode không hợp lệ: ${mode}. Các mode hợp lệ: ${Object.keys(MODES).join(
          ", "
        )}`
      );
    }

    console.log(`🔍 Đang xử lý câu hỏi (mode: ${mode}): "${message}"`);

    // ⚡ OPTIMIZATION: Kiểm tra cache trước
    const cachedResponse = cacheService.get(message, mode);
    if (cachedResponse) {
      console.log("🚀 Sử dụng cached response - tiết kiệm thời gian!");

      // Stream cached response
      const stream = (async function* () {
        yield cachedResponse;
      })();

      const saveHistoryCallback = async () => {
        const userMessage = new HumanMessage(message);
        const aiMessage = new AIMessage(cachedResponse);
        const fullHistory = await this.loadConversation(sessionId);
        fullHistory.push(userMessage, aiMessage);
        await this.saveConversation(sessionId, fullHistory);
      };

      return {
        stream,
        saveHistoryCallback,
        usedGoogle: false,
        fromCache: true,
      };
    }

    // Load vectorStore cho mode này
    const vectorStore = await loadVectorStore(mode);

    if (!vectorStore) {
      throw new Error(
        `Vector Store cho mode ${mode} chưa sẵn sàng. Hãy chạy: node ingest.js --mode ${mode}`
      );
    }

    // ✅ Kiểm tra các câu lịch sự/kết thúc trước
    const gratitudePatterns =
      /^(cảm ơn|thank|thanks|cám ơn|tks|ok|oke|được rồi|hiểu rồi|rõ rồi|đã hiểu)$/i;
    const greetingPatterns = /^(chào|hello|hi|xin chào|hey)$/i;

    const isGratitude = gratitudePatterns.test(message.trim());
    const isGreeting = greetingPatterns.test(message.trim());

    // Lấy lịch sử hội thoại trước - CHỈ LẤY 2 TIN NHẮN GẦN NHẤT để tránh overfitting
    const history = await this.loadConversation(sessionId);

    // Chỉ dùng lịch sử khi câu hỏi có tham chiếu đến câu trước (ngắn, mơ hồ)
    const needsHistory =
      message.length < 30 || /(nó|đó|thế|vậy|còn|tiếp|nữa)/i.test(message);
    const recentHistory = needsHistory ? history.slice(-2) : []; // Chỉ lấy lịch sử khi cần

    const historyContext = recentHistory
      .map((msg) => {
        const role = msg instanceof HumanMessage ? "Người dùng" : "MyU Bot";
        return `${role}: ${msg.content}`;
      })
      .join("\n");

    const isFirstMessage = history.length === 0;

    // ✅ Xử lý câu cảm ơn/lịch sự
    if (isGratitude && !isFirstMessage) {
      const gratitudeResponse =
        "Không có gì! 😊 Nếu bạn còn thắc mắc gì về Đại học Văn Hiến, cứ hỏi mình nhé! ✨";

      const stream = (async function* () {
        yield gratitudeResponse;
      })();

      const saveHistoryCallback = async () => {
        const userMessage = new HumanMessage(message);
        const aiMessage = new AIMessage(gratitudeResponse);
        const fullHistory = await this.loadConversation(sessionId);
        fullHistory.push(userMessage, aiMessage);
        await this.saveConversation(sessionId, fullHistory);
      };

      return { stream, saveHistoryCallback, usedGoogle: false };
    }

    // ✅ Xử lý câu chào (chỉ khi người dùng chào, KHÔNG tự động chào khi tin nhắn đầu)
    if (isGreeting) {
      const greetingResponse =
        "Chào bạn! 😊 Mình là MyU Bot - trợ lý tuyển sinh Đại học Văn Hiến. Bạn muốn hỏi gì về trường mình không?";

      const stream = (async function* () {
        yield greetingResponse;
      })();

      const saveHistoryCallback = async () => {
        const userMessage = new HumanMessage(message);
        const aiMessage = new AIMessage(greetingResponse);
        const fullHistory = await this.loadConversation(sessionId);
        fullHistory.push(userMessage, aiMessage);
        await this.saveConversation(sessionId, fullHistory);
      };

      return { stream, saveHistoryCallback, usedGoogle: false };
    }

    // ✅ THÊM: XỬ LÝ CÂU HỎI TÍNH ĐIỂM - CẢI TIẾN
    // Chỉ kích hoạt tool khi có ĐIỂM SỐ hoặc YÊU CẦU TÍNH TOÁN rõ ràng
    const hasScoreNumbers = /\d+([.,]\d+)?/g.test(message); // Có số (điểm)
    const hasCalculationIntent =
      /(tính điểm|điểm của (tôi|mình|em)|đủ điểm|kiểm tra điểm|xem điểm tôi|tôi được bao nhiêu điểm|đậu vào|đậu được|trúng tuyển|có thể vào|có đủ điểm)/i.test(
        message
      );
    const isListingQuestion =
      /(liệt kê|các ngành|ngành nào|những ngành|danh sách|có những ngành|gồm những ngành)/i.test(
        message
      );

    // Chỉ dùng tool khi:
    // 1. Có intent tính toán + có số HOẶC
    // 2. Có từ "gợi ý tổ hợp" + có số
    // NHƯNG KHÔNG phải câu hỏi liệt kê
    const needsCalculation =
      !isListingQuestion &&
      ((hasCalculationIntent && hasScoreNumbers) ||
        (/gợi ý tổ hợp/i.test(message) && hasScoreNumbers));

    if (needsCalculation) {
      console.log("🧮 Phát hiện câu hỏi về tính điểm, xử lý với tool...");

      try {
        // Lấy thông tin điểm từ lịch sử nếu câu hỏi hiện tại không có điểm
        let previousScore = null;
        let previousCombination = null;

        if (recentHistory.length > 0) {
          const lastAIMessage = recentHistory
            .filter((msg) => msg instanceof AIMessage)
            .pop();

          if (lastAIMessage) {
            // Tìm tổng điểm trong câu trả lời trước
            const scoreMatch = lastAIMessage.content.match(
              /Tổng điểm:\s*(\d+\.?\d*)/i
            );
            if (scoreMatch) {
              previousScore = parseFloat(scoreMatch[1]);
              console.log("📊 Tìm thấy điểm từ lịch sử:", previousScore);
            }

            // Tìm tổ hợp trong câu trả lời trước
            const combMatch = lastAIMessage.content.match(
              /tổ hợp\s+([A-Z]\d{2})/i
            );
            if (combMatch) {
              previousCombination = combMatch[1];
              console.log(
                "📋 Tìm thấy tổ hợp từ lịch sử:",
                previousCombination
              );
            }
          }
        }

        // Dùng LLM để extract parameters từ câu hỏi
        const extractPrompt = `Phân tích câu hỏi sau và trích xuất thông tin tính điểm xét tuyển.
Câu hỏi: "${message}"
${previousScore ? `\nĐiểm từ câu hỏi trước: ${previousScore}` : ""}
${
  previousCombination ? `\nTổ hợp từ câu hỏi trước: ${previousCombination}` : ""
}

Hãy phân tích và trả về JSON với format chính xác:
{
  "intents": ["calculate_score", "check_eligibility"] (MẢNG các intent, có thể có nhiều intent),
  "scores": {"toán": 8, "lý": 7.5, "hóa": 9} (nếu có đề cập điểm các môn),
  "combination": "A00" (nếu có đề cập tổ hợp, viết HOA),
  "majorCode": "7380101" (nếu có đề cập mã ngành 7 chữ số hoặc tên ngành),
  "majorName": "Luật" (nếu có đề cập tên ngành)
}

LƯU Ý QUAN TRỌNG:
- "intents" là MẢNG, CÓ THỂ chứa NHIỀU giá trị cùng lúc!
- Nếu câu hỏi có "tính điểm" + "xem đủ điểm" → intents: ["calculate_score", "check_eligibility"]
- Nếu chỉ có "tính điểm" → intents: ["calculate_score"]
- Nếu chỉ có "đủ điểm/đậu vào" → intents: ["check_eligibility"]
- Nếu chỉ có "gợi ý tổ hợp" → intents: ["suggest_combinations"]
- Tên môn viết thường có dấu: toán, lý, hóa, văn, anh, sử, địa
- Tổ hợp viết HOA: A00, A01, D01, C00, C04...
- Các ngành thường gặp:
  * Luật → majorCode: "7380101"
  * Kinh doanh thương mại → majorCode: "7340121"
  * Văn học → majorCode: "7229030"
  * Công nghệ thông tin → majorCode: "7480201"
  * Kế toán → majorCode: "7810101"
- Nếu câu hỏi đề cập "điểm đó" hoặc "điểm này" mà có điểm từ lịch sử, KHÔNG cần scores trong JSON

CHỈ TRẢ VỀ JSON, KHÔNG GIẢI THÍCH:`;

        const extractResult = await ollama.invoke(extractPrompt);
        console.log("📝 Extract result:", extractResult.content);

        // Parse JSON từ response
        let jsonMatch = extractResult.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("Không parse được JSON từ LLM");
        }

        const params = JSON.parse(jsonMatch[0]);

        // Bổ sung điểm từ lịch sử nếu câu hỏi đề cập "điểm đó"/"điểm này"
        if (
          previousScore &&
          !params.scores &&
          (message.includes("điểm đó") ||
            message.includes("điểm này") ||
            message.includes("điểm trên"))
        ) {
          params.totalScore = previousScore;
          console.log("✅ Sử dụng điểm từ lịch sử:", previousScore);
        }

        console.log("🔍 Parsed params:", params);

        // Xử lý multi-intent: chuyển intent đơn thành array
        const intents = Array.isArray(params.intents)
          ? params.intents
          : params.intent
          ? [params.intent]
          : [];

        if (intents.length === 0) {
          throw new Error("Không xác định được intent");
        }

        console.log("🎯 Processing intents:", intents);

        const toolResults = {};
        let calculatedScore = null;

        // Xử lý từng intent theo thứ tự
        for (const intent of intents) {
          switch (intent) {
            case "calculate_score":
              if (!params.scores || !params.combination) {
                toolResults.calculate_score = {
                  error:
                    "Để tính điểm, vui lòng cung cấp: điểm 3 môn và tổ hợp.\nVí dụ: 'Tính điểm tổ hợp A00: Toán 8, Lý 7.5, Hóa 9'",
                };
              } else {
                const result = this.calculateAdmissionScore({
                  scores: params.scores,
                  combination: params.combination,
                });
                toolResults.calculate_score = result;
                if (!result.error) {
                  calculatedScore = parseFloat(result.totalScore);
                }
                console.log("✅ Calculate result:", result);
              }
              break;

            case "check_eligibility":
              // Sử dụng điểm vừa tính hoặc điểm từ params
              let totalScore = calculatedScore || params.totalScore;

              // Nếu chưa có điểm nhưng có scores + combination, tính luôn
              if (!totalScore && params.scores && params.combination) {
                const scoreResult = this.calculateAdmissionScore({
                  scores: params.scores,
                  combination: params.combination,
                });
                if (!scoreResult.error) {
                  totalScore = parseFloat(scoreResult.totalScore);
                }
              }

              if (!totalScore) {
                toolResults.check_eligibility = {
                  error:
                    "Để kiểm tra đủ điểm, vui lòng cho biết tổng điểm hoặc điểm 3 môn của bạn.",
                };
              } else {
                // Nếu có majorName, map sang majorCode
                const majorMapping = {
                  luật: "7380101",
                  "luật kinh tế": "7380107",
                  "kinh doanh thương mại": "7340121",
                  "văn học": "7229030",
                  "công nghệ thông tin": "7480201",
                  "kế toán": "7810101",
                  "kiểm toán": "7810103",
                  "quản trị kinh doanh": "7340101",
                  marketing: "7340115",
                  "thương mại điện tử": "7340122",
                  logistics: "7340201",
                };

                let majorCode = params.majorCode;
                if (!majorCode && params.majorName) {
                  const majorNameLower = params.majorName.toLowerCase();
                  majorCode = majorMapping[majorNameLower] || "default";
                  console.log(
                    `🔄 Map "${params.majorName}" → code: ${majorCode}`
                  );
                }

                const result = this.checkEligibility({
                  totalScore: totalScore,
                  majorCode: majorCode || "default",
                });
                toolResults.check_eligibility = result;
                console.log("✅ Eligibility result:", result);
              }
              break;

            case "suggest_combinations":
              if (!params.scores || Object.keys(params.scores).length === 0) {
                toolResults.suggest_combinations = {
                  error:
                    "Để gợi ý tổ hợp, vui lòng cho biết điểm các môn của bạn.\nVí dụ: 'Toán 8, Văn 7, Anh 9, Lý 7.5'",
                };
              } else {
                const result = this.suggestBestCombinations({
                  scores: params.scores,
                });
                toolResults.suggest_combinations = result;
                console.log("✅ Suggest result:", result);
              }
              break;

            default:
              console.warn("⚠️ Unknown intent:", intent);
          }
        }

        // Gộp tất cả kết quả
        const toolResult = {
          multiIntent: intents.length > 1,
          results: toolResults,
        };

        console.log(
          "📦 Combined tool result:",
          JSON.stringify(toolResult, null, 2)
        );

        // Build conditional instructions
        let multiIntentInstructions = "";
        if (toolResult.multiIntent) {
          multiIntentInstructions = `
🔀 CÂU HỎI KẾT HỢP (có nhiều yêu cầu):
- Trả lời ĐẦY ĐỦ tất cả yêu cầu
- Phần 1: Tính điểm tổ hợp (nếu có calculate_score trong results)
- Phần 2: Kiểm tra đủ điểm vào ngành (nếu có check_eligibility trong results)
- Phần 3: Gợi ý tổ hợp khác (nếu có suggest_combinations trong results)
- KHÔNG bỏ sót bất kỳ phần nào!
`;
        }

        // Format lại kết quả bằng LLM
        const formatPrompt = `Bạn là trợ lý tuyển sinh Đại học Văn Hiến thân thiện. Dựa trên kết quả tính toán, hãy trả lời người dùng bằng TIẾNG VIỆT.

Câu hỏi: "${message}"

Kết quả tính toán: ${JSON.stringify(toolResult, null, 2)}

⚠️ QUY TẮC BẮT BUỘC:
- BẮT BUỘC sử dụng TIẾNG VIỆT để trả lời
- NGHIÊM CẤM tự giới thiệu ("Tôi là...", "Chào bạn...")
- NGHIÊM CẤM gợi ý sai (như tổ hợp 2 môn)
- CHỈ trình bày kết quả từ dữ liệu tính toán phía trên
- Nếu có NHIỀU kết quả (multiIntent: true), trình bày TẤT CẢ theo thứ tự logic
- QUAN TRỌNG: Phân tích JSON kết quả kỹ trước khi trả lời:
  * Nếu có "error" → nói thiếu dữ liệu
  * Nếu có "totalScore" hoặc "combination" → ĐÃ TÍNH ĐƯỢC, hiển thị kết quả
  * KHÔNG được mâu thuẫn giữa việc hiển thị số liệu và nói "không thể tính"

${
  toolResult.results && Object.keys(toolResult.results).length > 0
    ? `📋 CÁCH TRÌNH BÀY KẾT QUẢ:

${
  toolResult.multiIntent
    ? `🔀 CÂU HỎI KẾT HỢP (có nhiều yêu cầu):
- Trả lời ĐẦY ĐỦ tất cả yêu cầu
- Phần 1: Tính điểm tổ hợp (nếu có calculate_score)
- Phần 2: Kiểm tra đủ điểm vào ngành (nếu có check_eligibility)
- Phần 3: Gợi ý tổ hợp khác (nếu có suggest_combinations)
- KHÔNG bỏ sót bất kỳ phần nào!`
    : ""
}


1. Nếu tính điểm tổ hợp (có calculate_score trong results):
   - KIỂM TRA: Nếu có trường "error" → nói thiếu thông tin
   - KIỂM TRA: Nếu có "totalScore" → HIỂN THỊ kết quả đầy đủ:
     * Tiêu đề: "🎯 Kết quả tổ hợp [Tên tổ hợp]"
     * Liệt kê điểm từng môn với emoji 📝
     * Tổng điểm (VD: ✨ Tổng điểm: 24.5/30)
     * Điểm trung bình (VD: 📈 Điểm TB: 8.17/10)
     * Nhận xét ngắn + động viên
   - KHÔNG được tự ý nói "không thể tính" khi đã có totalScore

2. Nếu kiểm tra đủ điểm vào ngành:
   - Kết luận rõ ràng ngay đầu (✅ ĐỦ ĐIỂM hoặc ❌ CHƯA ĐỦ ĐIỂM)
   - Tên ngành + mã ngành (nếu có)
   - So sánh: điểm của bạn (X) vs điểm chuẩn ngành (Y)
   - Chênh lệch cụ thể (cao hơn/thấp hơn bao nhiêu)
   - Nếu ĐỦ: Chúc mừng + khuyến khích đăng ký
   - Nếu CHƯA ĐỦ: Động viên + gợi ý ngành khác phù hợp

3. Nếu gợi ý tổ hợp:
   - Liệt kê top 3 tổ hợp (đánh số 1️⃣ 2️⃣ 3️⃣)
   - Mỗi tổ hợp: tên + điểm + lý do phù hợp
   - Gợi ý nên chọn tổ hợp nào

📝 CẤU TRÚC:
- Dùng emoji phù hợp: 🎯, 📊, ✅, ❌, 💪, 🎓, 🎉, ✨
- Bullet points để dễ đọ
- Số liệu CHÍNH XÁC từ kết quả tính toán
- Kết thúc bằng 1 câu động viên ngắn

⚠️ LƯU Ý QUAN TRỌNG:
- KHÔNG được tự ý thêm câu "Vì kết quả tính toán không thể tính điểm..." nếu đã tính được điểm
- CHỈ nói "không thể tính" khi có lỗi hoặc thiếu dữ liệu (có trường .error)
- Nếu tính được điểm (có totalScore), BẮT BUỘC hiển thị kết quả chính xác
- KHÔNG tự ý thêm gợi ý không liên quan nếu không được yêu cầu

✅ VÍ DỤ ĐÚNG (khi có totalScore: 24):
"🎯 Kết quả tổ hợp A01: Toán 8, Lý 7, Anh 9
• Toán: 📝 8/10
• Lý: 📝 7/10
• Anh: 📝 9/10
✨ Tổng điểm: 24/30
📈 Điểm TB: 8.0/10

Điểm số của bạn khá tốt! Hãy xem xét các ngành phù hợp với mức điểm này."

❌ SAI (tự ý nói không tính được khi đã có totalScore):
"Vì kết quả tính toán không thể tính điểm tổ hợp..."

BẮT ĐẦU TRẢ LỜI BẰNG TIẾNG VIỆT:`
    : ""
}`;

        const formattedResult = await ollama.invoke(formatPrompt);
        const finalAnswer = formattedResult.content;

        console.log("💬 Final answer:", finalAnswer);

        // Stream response
        const stream = (async function* () {
          yield finalAnswer;
        })();

        const saveHistoryCallback = async () => {
          const userMessage = new HumanMessage(message);
          const aiMessage = new AIMessage(finalAnswer);
          const fullHistory = await this.loadConversation(sessionId);
          fullHistory.push(userMessage, aiMessage);
          await this.saveConversation(sessionId, fullHistory);
          console.log("✅ Đã lưu lịch sử tính điểm");
        };

        return {
          stream,
          saveHistoryCallback,
          usedGoogle: false,
          usedTool: true,
        };
      } catch (error) {
        console.error("❌ Lỗi khi xử lý tính điểm:", error);
        // Fallback về chat thông thường nếu có lỗi
        console.log("⚠️ Fallback về chat thông thường");
      }
    }

    // 1. Tìm kiếm trong Database (nếu không phải mode web-search)
    let vhuDocs = [];
    let similarityScores = [];
    if (mode !== "web-search" && vectorStore) {
      // ⚡ OPTIMIZATION: Giảm k để tăng tốc độ search
      // Chỉ tăng k khi câu hỏi yêu cầu liệt kê nhiều thông tin
      const isListingMajors =
        /(liệt kê|các ngành|ngành nào|những ngành|danh sách)/i.test(message);
      const isTuitionQuestion = /(học phí|học bổng|chi phí|mức phí)/i.test(
        message
      );
      // Giảm k xuống để tăng tốc: 5 (default), 10 (tuition), 20 (listing)
      const k = isListingMajors ? 20 : isTuitionQuestion ? 10 : 5;

      // Sử dụng similaritySearchWithScore để lấy similarity scores
      const results = await vectorStore.similaritySearchWithScore(message, k);
      vhuDocs = results.map(([doc, score]) => doc);
      similarityScores = results.map(([doc, score]) => score);

      // Debug: Log số lượng documents, scores và preview
      console.log(
        `📚 Tìm kiếm với k=${k}, tìm thấy ${
          vhuDocs.length
        } documents từ ${mode.toUpperCase()}`
      );
      if (vhuDocs.length > 0) {
        console.log(
          `📊 Similarity scores: ${similarityScores
            .map((s) => s.toFixed(3))
            .join(", ")}`
        );
        console.log(
          `📄 Preview document đầu tiên (100 ký tự): ${vhuDocs[0].pageContent.substring(
            0,
            100
          )}...`
        );
      }
    }

    let context = "";
    let useGoogle = false;
    let isOutOfScope = false; // Flag để xác định câu hỏi ngoài phạm vi

    // 2. Kiểm tra relevance score và từ khóa
    if (this.hasRelevantVHUInfo(vhuDocs, message, similarityScores)) {
      console.log("✅ Sử dụng thông tin từ VHU Database");
      context = vhuDocs.map((doc) => doc.pageContent).join("\n\n");
      console.log(`📝 Context length: ${context.length} ký tự`);
    } else {
      // KHÔNG tìm thấy thông tin liên quan trong vector DB
      console.log("⚠️ KHÔNG tìm thấy thông tin liên quan trong Vector DB");

      // Với mode admission/student-support: TỪ CHỐI trả lời
      if (mode === "admission" || mode === "student-support") {
        console.log(`🚫 Mode ${mode}: Từ chối câu hỏi vì không có dữ liệu`);
        isOutOfScope = true;
      } else if (mode === "web-search") {
        // Mode web-search: Tìm kiếm Google
        console.log("🔍 Mode web-search: Tìm kiếm trên web");
        useGoogle = true;

        const googleResults = await this.searchTavily(message);

        if (googleResults) {
          context = googleResults;
        } else {
          context = "Không tìm thấy thông tin liên quan.";
        }
      }
    }

    // 3. Prompt - phân biệt câu hỏi trong/ngoài phạm vi
    let promptTemplate;

    // Lấy system prompt từ mode config
    const modeConfig = MODES[mode];
    const systemPrompt = modeConfig.systemPrompt;

    if (isOutOfScope) {
      // Câu hỏi ngoài phạm vi - TỪ CHỐI lịch sự và hướng dẫn
      console.log(`🚫 Từ chối câu hỏi ngoài phạm vi mode ${mode}`);

      let refusalMessage = "";
      if (mode === "admission") {
        refusalMessage = `Xin lỗi bạn, tôi không biết câu trả lời cho câu hỏi này! 🎓

Tôi là trợ lý tư vấn tuyển sinh Đại học Văn Hiến, chỉ có thể giúp bạn về:
• Quy trình xét tuyển, hồ sơ đăng ký
• Thông tin các ngành học, tổ hợp môn  
• Học phí, học bổng
• Tính điểm xét tuyển
• Địa chỉ trường, cơ sở vật chất VHU

💡 **Gợi ý**: 
- Nếu bạn cần hỏi về tuyển sinh VHU, hãy hỏi tôi về: ngành học, điểm chuẩn, học phí, hồ sơ...
- Nếu bạn cần thông tin khác ngoài tuyển sinh, vui lòng chọn chế độ **"Trò chuyện & Tìm kiếm"** (option 3) để tiếp tục trò chuyện! 🔍`;
      } else if (mode === "student-support") {
        refusalMessage = `Xin lỗi bạn, tôi không biết câu trả lời cho câu hỏi này! 📚

Tôi là trợ lý hỗ trợ sinh viên Đại học Văn Hiến, chỉ có thể giúp bạn về:
• Lịch học, lịch thi, quy chế đào tạo
• Thủ tục hành chính (giấy xác nhận, chuyển ngành, bảo lưu...)
• Cơ sở vật chất, thư viện, ký túc xá
• Dịch vụ sinh viên, câu lạc bộ, hoạt động ngoại khóa
• Giải đáp các vấn đề học tập tại VHU

💡 **Gợi ý**:
- Nếu bạn cần hỏi về học tập tại VHU, hãy hỏi tôi về: lịch thi, thủ tục, quy chế, dịch vụ sinh viên...
- Nếu bạn cần thông tin khác ngoài hỗ trợ sinh viên, vui lòng chọn chế độ **"Trò chuyện & Tìm kiếm"** (option 3) để tiếp tục trò chuyện! 🔍`;
      } else {
        refusalMessage = `Xin lỗi, tôi không tìm thấy thông tin liên quan trong cơ sở dữ liệu. Vui lòng thử lại với câu hỏi khác hoặc chuyển sang chế độ "Trò chuyện & Tìm kiếm" để được trợ giúp. 🔍`;
      }

      // Trả về luôn mà không cần gọi LLM
      const stream = (async function* () {
        yield refusalMessage;
      })();

      const saveHistoryCallback = async () => {
        const userMessage = new HumanMessage(message);
        const aiMessage = new AIMessage(refusalMessage);
        const fullHistory = await this.loadConversation(sessionId);
        fullHistory.push(userMessage, aiMessage);
        await this.saveConversation(sessionId, fullHistory);
      };

      return {
        stream,
        saveHistoryCallback,
        usedGoogle: false,
        usedTool: false,
      };
    } else {
      // Prompt cho câu hỏi về VHU - CÓ dùng lịch sử - SỬ DỤNG SYSTEM PROMPT TỪ MODE
      const promptParts = [
        systemPrompt, // Sử dụng system prompt từ mode config
        "",
        "🇻🇳 NGÔN NGỮ: BẮT BUỘC trả lời bằng TIẾNG VIỆT, KHÔNG được dùng tiếng Anh hay ngôn ngữ khác!",
        "",
        "QUY TẮC QUAN TRỌNG:",
        "1. CHỈ trả lời dựa trên dữ liệu bên dưới",
        "2. KHÔNG tự bịa đặt thông tin",
        "3. KHÔNG tự giới thiệu, KHÔNG chào hỏi",
        "4. Trả lời NGẮN GỌN, CHÍNH XÁC, bằng TIẾNG VIỆT",
        "5. Nếu không có thông tin trong dữ liệu, trả lời: 'Tôi không tìm thấy thông tin này trong dữ liệu. Vui lòng truy cập https://portal.vhu.edu.vn/ để biết thêm chi tiết.'",
        "",
        "⚠️ CÁCH TRẢ LỜI VỀ HỌC PHÍ:",
        "- Khi được hỏi học phí một ngành CỤ THỂ:",
        "  + Tìm CHÍNH XÁC ngành đó trong dữ liệu bên dưới (kiểm tra tên ngành)",
        "  + Copy CHÍNH XÁC số liệu học phí từ dữ liệu (VD: 15.204.000đ cho 12 tín chỉ)",
        "  + TUYỆT ĐỐI KHÔNG tự bịa số, KHÔNG làm tròn số, KHÔNG sửa đổi số liệu",
        "  + Tính học phí/tín chỉ: Chia học phí HK1 cho số tín chỉ",
        "  + KHÔNG đưa ra khoảng học phí chung (728.000đ - 1.838.000đ)",
        "  + KHÔNG nói 'tùy ngành'",
        "- Khi được hỏi học phí CHUNG của tất cả các ngành:",
        "  + Mới trả lời khoảng: 'Từ 728.000đ – 1.838.000đ/tín chỉ (tùy ngành)'",
        "",
        "VÍ DỤ TRẢ LỜI (bằng TIẾNG VIỆT):",
        "Câu hỏi: 'Học phí ngành Ngôn ngữ Anh?'",
        "❌ SAI: 'Học phí từ 728.000đ đến 1.838.000đ/tín chỉ'",
        "❌ SAI: 'Total tuition fee: 14,400,000 VND' (tiếng Anh + số sai!)",
        "❌ SAI: 'Học phí khoảng 14 triệu đồng' (số tự bịa!)",
        "✅ ĐÚNG: 'Học phí học kỳ 1 ngành Ngôn ngữ Anh năm 2025-2026 là 15.204.000đ (12 tín chỉ), tương đương 1.267.000đ/tín chỉ. Ngành này thuộc Nhóm 5.'",
        "",
        "DỮ LIỆU:",
        "{context}",
        "",
      ];

      // Thêm lịch sử nếu có
      if (historyContext) {
        promptParts.push("Lịch sử hội thoại:", historyContext, "");
      }

      promptParts.push(
        "Câu hỏi: {question}",
        "",
        "🇻🇳 Trả lời bằng TIẾNG VIỆT:"
      );

      promptTemplate = PromptTemplate.fromTemplate(promptParts.join("\n"));
    }

    // 5. Tạo chain với stream
    const chain = RunnableSequence.from([
      promptTemplate,
      ollama,
      new StringOutputParser(),
    ]);

    // 6. Helper function để clean response - cải tiến
    const cleanResponse = (text) => {
      // Loại bỏ nhiều patterns tự giới thiệu
      text = text.replace(
        /^(Xin chào!?\s*)?(Tôi|Mình) là (MyU Bot|trợ lý tuyển sinh)[^\n]*\.?\s*/gi,
        ""
      );
      text = text.replace(/^Chào bạn!?\s*(Tôi|Mình) là[^\n]*\.?\s*/gi, "");
      text = text.replace(/^(Tôi|Mình) là trợ lý[^\n]*\.?\s*/gi, "");

      // Loại bỏ các dòng với emoji và format không mong muốn
      text = text.replace(/^🎉\s*CÂU HỎI HIỆN TẠI:.*$/gim, "");
      text = text.replace(/^❓\s*CÂU HỎI HIỆN TẠI.*$/gim, "");
      text = text.replace(/^🇻🇳\s*TRẢ LỜI.*$/gim, ""); // Loại bỏ dòng "🇻🇳 TRẢ LỜI 🇻🇳 ..."
      text = text.replace(/^👍\s*CHÚC MỪNG!?\s*$/gim, "");
      text = text.replace(/^🎯.*$/gim, ""); // Loại bỏ dòng bắt đầu với 🎯

      // Loại bỏ dòng "Trả lời:" đứng một mình
      text = text.replace(/^Trả lời:\s*$/gim, "");

      // Loại bỏ câu "Về câu hỏi của bạn"
      text = text.replace(/^Về câu hỏi của bạn,?\s*/gi, "");

      // Loại bỏ câu phỏng đoán tính cách không cần thiết
      text = text.replace(
        /Để định hướng nghề nghiệp cho bạn, tôi sẽ phân tích tính cách của bạn\.[^\n]*\n*/gi,
        ""
      );
      text = text.replace(/Bạn có thể là người:\s*\n(•[^\n]*\n)*/gi, "");

      // Loại bỏ câu lặp lại câu hỏi
      const questionLower = message.toLowerCase();
      const lines = text.split("\n");
      const filteredLines = lines.filter((line) => {
        const lineLower = line.toLowerCase().trim();

        // Bỏ dòng chỉ chứa emoji
        if (/^[🎉❓🇻🇳👍🎯]+\s*$/.test(line.trim())) {
          return false;
        }

        // Bỏ dòng nào giống câu hỏi
        if (
          lineLower.includes(questionLower) &&
          lineLower.length < questionLower.length + 20
        ) {
          return false;
        }
        if (
          lineLower.startsWith("câu hỏi của người dùng:") ||
          lineLower.startsWith("câu hỏi:")
        ) {
          return false;
        }
        return true;
      });

      // Loại bỏ nhiều dòng trống liên tiếp
      let result = filteredLines.join("\n").trim();
      result = result.replace(/\n{3,}/g, "\n\n"); // Giữ tối đa 2 dòng trống

      return result;
    };

    // 7. Stream response với filtering - truyền context/question tùy loại câu hỏi
    const streamInput = isOutOfScope
      ? { question: message } // Câu hỏi ngoài phạm vi - chỉ cần question
      : {
          context: context || "Không có thông tin liên quan.",
          question: message,
        }; // Câu hỏi VHU - cần cả context và question

    const rawStream = await chain.stream(streamInput);

    // Wrap stream để clean từng chunk
    const stream = (async function* () {
      let fullText = "";
      let isFirstChunk = true;

      for await (const chunk of rawStream) {
        fullText += chunk;

        // Chỉ clean và yield khi đã có đủ text (sau chunk đầu tiên)
        if (isFirstChunk && fullText.length > 50) {
          fullText = cleanResponse(fullText);
          yield fullText;
          fullText = "";
          isFirstChunk = false;
        } else if (!isFirstChunk) {
          yield chunk;
        }
      }

      // Clean phần còn lại nếu có
      if (isFirstChunk && fullText) {
        fullText = cleanResponse(fullText);
        yield fullText;
      }
    })();

    // 7. Callback lưu lịch sử
    const saveHistoryCallback = async (aiResponseText) => {
      const userMessage = new HumanMessage(message);
      const aiMessage = new AIMessage(aiResponseText);

      const fullHistory = await this.loadConversation(sessionId);
      fullHistory.push(userMessage, aiMessage);
      await this.saveConversation(sessionId, fullHistory);
      console.log("✅ Đã lưu lịch sử cho sessionId:", sessionId);

      // ⚡ OPTIMIZATION: Cache response sau khi lưu
      // Chỉ cache nếu không phải câu hỏi tính toán (vì có thể thay đổi)
      const isCalculationQuery = /(tính điểm|đủ điểm|gợi ý tổ hợp)/i.test(
        message
      );
      if (!isCalculationQuery && aiResponseText.length > 20) {
        cacheService.set(message, aiResponseText, mode);
        console.log("💾 Đã cache response cho câu hỏi này");
      }
    };

    return { stream, saveHistoryCallback, usedGoogle: useGoogle };
  }

  // ==================== WEB SEARCH METHOD ====================
  async webSearch(message, sessionId = "default") {
    console.log("💬 Mode: Trò chuyện tương tác + Web Search");

    // Lấy lịch sử hội thoại
    const history = await this.loadConversation(sessionId);
    const recentHistory = history.slice(-6); // Lấy 6 tin nhắn gần nhất

    const historyContext = recentHistory
      .map((msg) => {
        const role = msg instanceof HumanMessage ? "Sinh viên" : "MyU Bot";
        return `${role}: ${msg.content}`;
      })
      .join("\n");

    // Phát hiện nhu cầu tìm kiếm
    const needsSearch = this.detectSearchIntent(message);

    let searchResults = null;
    if (needsSearch) {
      console.log("🔍 Phát hiện nhu cầu tìm kiếm, đang tra cứu...");
      searchResults = await this.searchTavily(message);
    }

    // Tạo prompt dựa trên ngữ cảnh
    const promptParts = [
      "Bạn là MyU Bot - trợ lý AI thân thiện của sinh viên Đại học Văn Hiến.",
      "",
      "🇻🇳 QUAN TRỌNG: Luôn luôn trả lời bằng TIẾNG VIỆT, KHÔNG được dùng tiếng Anh hay ngôn ngữ khác!",
      "",
      "TÍNH CÁCH & VAI TRÒ:",
      "- Là người bạn thân thiết, luôn lắng nghe và đồng cảm",
      "- Trò chuyện tự nhiên, gần gũi, nhiệt tình",
      "- Hiểu tâm tư, tình cảm của sinh viên",
      "- Động viên, khích lệ khi cần thiết",
      "- Cung cấp thông tin chính xác khi được hỏi",
      "",
      "QUY TẮC TRẢ LỜI:",
      "1. Đọc lịch sử trò chuyện để hiểu ngữ cảnh",
      "2. Trả lời phù hợp với tâm trạng của sinh viên",
      "3. Nếu là tâm sự → Lắng nghe, đồng cảm, động viên",
      "4. Nếu là hỏi thông tin → Tra cứu và trả lời chính xác",
      "5. Tránh dài dòng, giữ giọng điệu tự nhiên",
      "6. KHÔNG tự giới thiệu mỗi lần trả lời",
      "7. Trả lời bằng TIẾNG VIỆT",
      "",
    ];

    if (historyContext) {
      promptParts.push("LỊCH SỬ TRÒ CHUYỆN:", historyContext, "");
    }

    if (searchResults) {
      promptParts.push(
        "THÔNG TIN TÌM KIẾM TỪ WEB:",
        searchResults,
        "",
        "⚠️ Sử dụng thông tin này để trả lời chính xác.",
        ""
      );
    }

    promptParts.push(`Câu hỏi/Tâm sự của sinh viên: "${message}"`);
    promptParts.push("", "🇻🇳 Trả lời bằng TIẾNG VIỆT:");

    const prompt = promptParts.join("\n");

    // Gọi Ollama với temperature cao hơn để trả lời tự nhiên
    const { ChatOllama } = await import("@langchain/ollama");
    const ollamaChat = new ChatOllama({
      baseUrl: process.env.URL || "http://localhost:11434",
      model: process.env.MODEL || "gemma2:2b",
      temperature: 0.7, // Tăng nhiệt độ để trò chuyện tự nhiên hơn
    });

    const streamResponse = await ollamaChat.stream(prompt);

    // Stream response
    const stream = (async function* () {
      for await (const chunk of streamResponse) {
        if (chunk.content) {
          yield chunk.content;
        }
      }
    })();

    // Callback lưu lịch sử
    const saveHistoryCallback = async (aiResponseText) => {
      const userMessage = new HumanMessage(message);
      const aiMessage = new AIMessage(aiResponseText);
      const fullHistory = await this.loadConversation(sessionId);
      fullHistory.push(userMessage, aiMessage);
      await this.saveConversation(sessionId, fullHistory);
      console.log("✅ Đã lưu lịch sử trò chuyện cho sessionId:", sessionId);
    };

    return { stream, saveHistoryCallback, usedGoogle: searchResults !== null };
  }

  /**
   * Phát hiện ý định tìm kiếm trong câu hỏi
   */
  detectSearchIntent(message) {
    const searchKeywords = [
      // Từ khóa tìm kiếm thông tin
      /tìm kiếm|search|google|tra cứu/i,
      /thông tin về|thông tin chi tiết/i,
      /tìm hiểu|tìm được|tìm cho/i,

      // Từ khóa hỏi về sự kiện, tin tức
      /tin tức|sự kiện|diễn ra|xảy ra/i,
      /mới nhất|cập nhật|hiện tại|bây giờ/i,

      // Từ khóa hỏi về địa điểm, dịch vụ
      /ở đâu|địa chỉ|nằm ở|tọa lạc/i,
      /quán|nhà hàng|cà phê|shop|cửa hàng/i,

      // Từ khóa hỏi về thời gian, lịch trình
      /khi nào|thời gian|ngày|giờ mở cửa/i,
      /lịch trình|kế hoạch/i,

      // Từ khóa hỏi về người nổi tiếng, tổ chức
      /ai là|người nào|tổ chức nào/i,
      /công ty|doanh nghiệp|trường học/i,

      // Từ khóa yêu cầu giải thích kiến thức
      /giải thích|định nghĩa|là gì|nghĩa là gì/i,
      /cách thức|làm thế nào|how to/i,
    ];

    // Kiểm tra độ dài câu hỏi (câu ngắn thường là chào hỏi, tâm sự)
    if (message.length < 20) {
      // Trừ một số trường hợp đặc biệt
      if (/tìm|search|thông tin|là gì/i.test(message)) {
        return true;
      }
      return false;
    }

    // Kiểm tra từ khóa tìm kiếm
    return searchKeywords.some((pattern) => pattern.test(message));
  }

  async clearHistory(sessionId) {
    try {
      await database.conversation.findOneAndDelete({ sessionId });
      this.conversationHistory.delete(sessionId);
      return {
        success: true,
        message: "Cuộc hội thoại đã được xóa thành công.",
      };
    } catch (error) {
      console.error("Lỗi khi xóa cuộc hội thoại:", error);
      this.conversationHistory.delete(sessionId);
    }
  }

  async getHistoryLength(sessionId = "default") {
    try {
      const conversation = await database.conversation.findOne({ sessionId });
      return conversation ? conversation.messages.length : 0;
    } catch (error) {
      console.error("Error getting history length:", error);
      return this.conversationHistory.get(sessionId)?.length || 0;
    }
  }

  /**
   * Lấy danh sách các mode khả dụng
   * Kiểm tra FAISS index có tồn tại hay không
   */
  async getAvailableModes() {
    const fs = await import("fs");
    const path = await import("path");

    const modesInfo = [];

    for (const [modeName, config] of Object.entries(MODES)) {
      const modeInfo = {
        id: modeName,
        name: this.getModeName(modeName),
        description: config.description,
        icon: this.getModeIcon(modeName),
        isAvailable: true,
        requiresIndex:
          config.faissPath !== undefined && config.faissPath !== null,
      };

      // Kiểm tra FAISS index có tồn tại không (chỉ cho mode có faissPath)
      if (config.faissPath) {
        const indexPath = path.default.join(process.cwd(), config.faissPath);
        try {
          const exists = fs.default.existsSync(indexPath);
          modeInfo.isAvailable = exists;
          if (!exists) {
            modeInfo.error = `FAISS index chưa được tạo. Chạy: node ingest.js --mode ${modeName}`;
          }
        } catch (error) {
          modeInfo.isAvailable = false;
          modeInfo.error = "Không thể kiểm tra FAISS index";
        }
      }

      modesInfo.push(modeInfo);
    }

    return modesInfo;
  }

  /**
   * Helper: Lấy tên hiển thị của mode
   */
  getModeName(modeId) {
    const names = {
      admission: "Tư vấn tuyển sinh",
      "student-support": "Hỗ trợ sinh viên",
      "web-search": "Trò chuyện & Tìm kiếm",
    };
    return names[modeId] || modeId;
  }

  /**
   * Helper: Lấy icon của mode
   */
  getModeIcon(modeId) {
    const icons = {
      admission: "🎓",
      "student-support": "🎒",
      "web-search": "💬",
    };
    return icons[modeId] || "📋";
  }
}

const chatService = new ChatService();
export default chatService;
