import { Router } from "express";
import userAuth from "../middleware/auth.middleware.js";
import Admin from "../model/Admin.model.js";
import Partner from "../model/Partner.model.js";
import validateNewPassword from "../utils/validations.js";
import bcrypt from "bcrypt";
const authRouter = Router();

//password change
authRouter.patch("/api/auth/change-password", userAuth, async (req, res) => {
  try {
    const { oldPassword, password } = req.body;
    if (!oldPassword || !password) {
      return res
        .status(400)
        .json({ message: "Old and new password are required" });
    }
    const Model = req.user.role === "admin" ? Admin : Partner;
    const user = await Model.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }
    validateNewPassword(req);
    user.password = await bcrypt.hash(password, 10);
    await user.save();
    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Something went wrong", error: error.message });
  }
});

//logout
authRouter.post("/api/auth/logout", userAuth, (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
  });
  res.send("Logout successful");
});

//current-user
authRouter.get("/api/auth/me", userAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

export default authRouter;
