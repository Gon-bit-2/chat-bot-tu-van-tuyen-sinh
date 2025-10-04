import express from "express";
const router = express.Router();
import chatRouter from "./chat/index.js";
import authRouter from "./auth/index.js";

// Router cho authentication (không cần middleware)
router.use("/v1/api/auth", authRouter);

// Router cho chat (có middleware authentication)
router.use("/v1/api", chatRouter);

export default router;
