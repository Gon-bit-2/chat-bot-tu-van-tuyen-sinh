import express from "express";
const router = express.Router();
import chatController from "../../controller/chat.controller.js";
router.post("/chat", chatController.chat);
export default router;
