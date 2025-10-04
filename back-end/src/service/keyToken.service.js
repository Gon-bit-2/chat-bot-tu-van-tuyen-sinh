import { Types } from "mongoose";
import database from "../config/database.js";

class KeyTokenService {
  async createKeyToken({ userId, publicKey, privateKey, refreshToken }) {
    try {
      const filter = { userId },
        update = { publicKey, privateKey, refreshTokensUsed: [], refreshToken },
        options = { upsert: true, new: true };
      const tokens = await database.token.findOneAndUpdate(
        filter,
        update,
        options
      );
      return tokens ? tokens.publicKey : null;
    } catch (error) {
      return error;
    }
  }
  async findByUserId(userId) {
    return await database.token.findOne({ userId });
  }
  async removeKeyById(id) {
    return await database.token.deleteOne({ _id: new Types.ObjectId(id) });
  }
  async findByRefreshTokenUsed(refreshToken) {
    return await database.token
      .findOne({ refreshTokensUsed: refreshToken })
      .lean();
  }
  async findByRefreshToken(refreshToken) {
    return await database.token.findOne({ refreshToken: refreshToken });
  }
  async deleteKeyById(userId) {
    return await database.token.deleteOne({ userId });
  }
}
const keyTokenService = new KeyTokenService();
export default keyTokenService;
