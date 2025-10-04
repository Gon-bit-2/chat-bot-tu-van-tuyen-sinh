import express from "express";
const router = express.Router();
import chatController from "../../controller/chat.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";

// Áp dụng middleware authentication cho tất cả các route trong chat
router.use(requireAuth);

router.post("/chat", chatController.chat);
export default router;
