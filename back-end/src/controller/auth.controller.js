"use strict";

import { SuccessResponse } from "../middleware/success.response.js";
import authService from "../service/auth.service.js";

class AuthController {
  signup = async (req, res) => {
    // console.log('[P]::signup::', req.body)
    const handleSignUp = await authService.sigUp(req.body);
    new SuccessResponse({
      message: "Sign Up Success",
      metadata: handleSignUp,
    }).send(res);
  };

  login = async (req, res) => {
    const handleLogin = await authService.login(req.body);
    new SuccessResponse({
      metadata: handleLogin,
    }).send(res);
  };

  logout = async (req, res) => {
    const handleLogout = await authService.logout(req.keyStore);
    new SuccessResponse({
      message: "Logout success",
      metadata: handleLogout,
    }).send(res);
  };

  handlerRefreshToken = async (req, res) => {
    const handleGetToken = await authService.handlerRefreshToken({
      refreshToken: req.refreshToken,
      user: req.user,
      keyStore: req.keyStore,
    });
    new SuccessResponse({
      message: "Get token success",
      metadata: handleGetToken,
    }).send(res);
  };
}

const authController = new AuthController();
export default authController;
