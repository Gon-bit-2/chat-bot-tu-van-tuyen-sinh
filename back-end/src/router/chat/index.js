import express from "express";
const router = express.Router();
import chatController from "../../controller/chat.controller.js";
import { authentication } from "../../utils/jwt.js";

// Áp dụng middleware authentication cho tất cả các route trong chat
router.use(authentication);

router.post("/chat", chatController.chat);
router.post("/chat/conversation", chatController.createConversation);
router.post("/chat/clear", chatController.clearHistory);
export default router;
