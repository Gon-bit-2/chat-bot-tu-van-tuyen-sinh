import express from "express";
const router = express.Router();
import authController from "../../controller/auth.controller.js";
import { authentication } from "../../utils/jwt.js";

router.post("/register", authController.signup);
router.post("/login", authController.login);
router.post("/logout", authentication, authController.logout);
router.post("/refresh-token", authController.handlerRefreshToken);
router.get("/me", authentication, authController.getCurrentUser);
export default router;
