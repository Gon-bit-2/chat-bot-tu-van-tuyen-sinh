import jwt from "jsonwebtoken";
import { authentication } from "../utils/jwt.js";
import keyTokenService from "../service/keyToken.service.js";

// Middleware authentication cho các route cần xác thực
export const requireAuth = authentication;

// Middleware optional authentication (không bắt buộc phải có token)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      // Nếu không có token, vẫn cho phép tiếp tục nhưng không có thông tin user
      req.user = null;
      return next();
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      req.user = null;
      return next();
    }

    const token = parts[1];

    // Decode token để lấy userId (không verify signature)
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.userId) {
      req.user = null;
      return next();
    }

    // Lấy publicKey từ database dựa trên userId
    const keyStore = await keyTokenService.findByUserId(decoded.userId);
    if (!keyStore) {
      req.user = null;
      return next();
    }

    // Verify token với publicKey từ database
    const verifiedDecoded = await jwt.verify(token, keyStore.publicKey);
    req.user = verifiedDecoded;
    req.keyStore = keyStore;
    next();
  } catch (error) {
    // Nếu có lỗi, vẫn cho phép tiếp tục nhưng không có thông tin user
    req.user = null;
    next();
  }
};
