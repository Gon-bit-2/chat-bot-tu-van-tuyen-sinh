import express from "express";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import router from "./src/router/index.js";
import database from "./src/config/database.js";

const app = express();

// ⚡ OPTIMIZATION: Compression middleware - nén response để giảm bandwidth
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // Compression level (0-9, default 6)
  })
);

// ⚡ OPTIMIZATION: Rate limiting - chống spam và DDoS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Giới hạn 100 requests mỗi windowMs
  message: "Quá nhiều requests từ IP này, vui lòng thử lại sau 15 phút",
  standardHeaders: true,
  legacyHeaders: false,
});

// Áp dụng rate limiting cho tất cả routes
app.use(limiter);

// Rate limiting riêng cho chat endpoint (nghiêm ngặt hơn)
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 20, // Tối đa 20 messages/phút
  message: "Bạn đang gửi tin nhắn quá nhanh, vui lòng chờ 1 phút",
});

app.use("/v1/api/chat", chatLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use("/", router);

database.connectDB();

const PORT = process.env.PORT || 4321;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`⚡ Compression: enabled`);
  console.log(`🛡️  Rate limiting: enabled`);
});
