import express from "express";
const router = express.Router();
import authController from "../../controller/auth.controller.js";
router.post("/register", authController.signup);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.post("/refresh-token", authController.handlerRefreshToken);
export default router;
