import jwt from "jsonwebtoken";
import keyTokenService from "../service/keyToken.service.js";

const createTokenPair = async (payload, publicKey, privateKey) => {
  const accessToken = await jwt.sign(payload, publicKey, {
    expiresIn: "7d",
  });
  const refreshToken = await jwt.sign(payload, privateKey, {
    expiresIn: "7d",
  });
  //
  jwt.verify(accessToken, publicKey, (err, decoded) => {
    if (err) {
      console.error(`error verify`, err);
    } else {
      console.log(`decoded verify`, decoded);
    }
  });
  return {
    accessToken,
    refreshToken,
  };
};

const authentication = async (req, res, next) => {
  try {
    // Kiểm tra xem có header Authorization không
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
      });
    }

    // Kiểm tra format Bearer token
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    const token = parts[1];

    // Decode token để lấy userId (không verify signature)
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // Lấy publicKey từ database dựa trên userId
    const keyStore = await keyTokenService.findByUserId(decoded.userId);
    if (!keyStore) {
      return res.status(401).json({
        success: false,
        message: "Token not found",
      });
    }

    // Verify token với publicKey từ database
    const verifiedDecoded = await jwt.verify(token, keyStore.publicKey);
    req.user = verifiedDecoded;
    req.keyStore = keyStore;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
      });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Authentication error",
      });
    }
  }
};

export { createTokenPair, authentication };
