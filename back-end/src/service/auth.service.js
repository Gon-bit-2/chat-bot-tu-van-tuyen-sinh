import database from "../config/database.js";
import { hashPassword, comparePassword } from "../utils/hashPassword.js";
import crypto from "crypto";
import { getInfoData } from "../utils/info.js";
import keyTokenService from "./keyToken.service.js";
import { createTokenPair } from "../utils/jwt.js";
import {
  BadRequestError,
  AuthFailureError,
  ForbiddenError,
} from "../middleware/error.middleware.js";

class AuthService {
  async signup(user) {
    const existUser = await database.user.findOne({ email: user.email }).lean();
    if (existUser) {
      throw new BadRequestError("User already exists");
    }
    const hashedPassword = await hashPassword(user.password);

    const newUser = await database.user.create({
      ...user,
      password: hashedPassword,
    });
    if (newUser) {
      //apikey

      //create private key and public key
      const privateKey = crypto.randomBytes(64).toString("hex");
      const publicKey = crypto.randomBytes(64).toString("hex");
      console.log({ privateKey, publicKey });
      //create token pair
      const tokens = await createTokenPair(
        { userId: newUser._id, email: newUser.email },
        publicKey,
        privateKey
      );
      //lưu vào db
      const keyStore = await keyTokenService.createKeyToken({
        userId: newUser._id.toString(),
        publicKey,
        privateKey,
        refreshToken: tokens.refreshToken,
      });
      console.log("Key Store>>>>", keyStore);

      if (!keyStore) {
        return {
          code: "xxxx",
          message: "publicKey error",
        };
      }

      console.log(`create token successfully`, tokens);
      return {
        code: 201,
        metadata: {
          user: getInfoData({
            fields: ["_id", "name", "email"],
            object: newUser,
          }),
          tokens,
        },
      };
    }
    return {
      status: false,
      metadata: null,
    };
  }
  login = async ({ email, password, refreshToken = null }) => {
    // 1. Tìm shop dựa trên email
    const foundShop = await database.user.findOne({ email });
    if (!foundShop) throw new BadRequestError("Shop chưa được đăng ký");

    // 2. So khớp mật khẩu
    const isMatch = await comparePassword(password, foundShop.password);
    if (!isMatch) throw new AuthFailureError("Sai thông tin xác thực");

    // 3. Tạo privateKey và publicKey mới
    const privateKey = crypto.randomBytes(64).toString("hex");
    const publicKey = crypto.randomBytes(64).toString("hex");

    // 4. Tạo cặp token mới
    const tokens = await createTokenPair(
      { userId: foundShop._id, email },
      publicKey,
      privateKey
    );

    // 5. Lưu hoặc cập nhật key store với thông tin mới
    await keyTokenService.createKeyToken({
      userId: foundShop._id.toString(),
      privateKey,
      publicKey,
      refreshToken: tokens.refreshToken,
    });

    return {
      user: getInfoData({
        fields: ["_id", "name", "email"],
        object: foundShop,
      }),
      tokens,
    };
  };
  logout = async (keyStore) => {
    // console.log('check keystore', keyStore._id)

    const delKey = await keyTokenService.removeKeyById(keyStore._id);
    console.log("delete key >>>", delKey);

    return delKey;
  };
  handlerRefreshToken = async ({ refreshToken, user, keyStore }) => {
    const { userId, email } = user;

    if (keyStore.refreshTokensUsed.includes(refreshToken)) {
      await keyTokenService.deleteKeyById(userId);
      throw new ForbiddenError("Something wrong happend !! Pls reLogin");
    }
    if (keyStore.refreshToken !== refreshToken) {
      throw new AuthFailureError("User not registered 1");
    }

    const foundUser = await database.user.findOne({ email });
    if (!foundUser) {
      throw new AuthFailureError("User not registered 2");
    }

    //create token mới
    const tokens = await createTokenPair(
      { userId, email },
      keyStore.publicKey,
      keyStore.privateKey
    );
    //update
    await keyStore.updateOne({
      $set: {
        refreshToken: tokens.refreshToken,
      },
      $addToSet: {
        refreshTokensUsed: refreshToken, //đã sử dụng lấy token mới nên add vô phần đã sử dụng
      },
    });

    return {
      user: { userId, email },
      tokens,
    };
  };
}
const authService = new AuthService();
export default authService;
