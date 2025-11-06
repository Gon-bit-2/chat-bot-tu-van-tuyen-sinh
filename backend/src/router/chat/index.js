import express from "express";
const router = express.Router();
import chatController from "../../controller/chat.controller.js";
import { authentication } from "../../utils/jwt.js";

// Áp dụng middleware authentication cho tất cả các route trong chat
router.use(authentication);

router.get("/modes", chatController.getModes); // GET /v1/api/chat/modes - Lấy danh sách modes
router.post("/", chatController.chat); // POST /v1/api/chat
router.post("/web-search", chatController.webSearch); // POST /v1/api/chat/web-search
router.post("/conversation", chatController.createConversation); // POST /v1/api/chat/conversation
router.get("/conversations", chatController.getAllConversations); // GET /v1/api/chat/conversations (danh sách tất cả)
router.get("/history/:sessionId", chatController.getHistory); // GET /v1/api/chat/history/:sessionId
router.post("/clear", chatController.clearHistory); // POST /v1/api/chat/clear
export default router;
