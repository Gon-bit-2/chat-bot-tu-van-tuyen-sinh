import express from "express";
const router = express.Router();
import chatRouter from "./chat/index.js";
router.use("/v1/api", chatRouter);
export default router;
