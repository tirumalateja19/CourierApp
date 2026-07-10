import { Router } from "express";
import userAuth from "../middleware/auth.middleware.js";
import Admin from "../model/Admin.model.js";
import validateNewPassword from "../utils/validations.js";
import bcrypt from "bcrypt";
const authRouter = Router();

//password change
authRouter.patch("/api/auth/change-password", userAuth, async (req, res) => {
  try {
    validateNewPassword(req);
    const loggedInUser = req.admin;
    const { password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    await Admin.findByIdAndUpdate(loggedInUser.id, { password: passwordHash });
    res.send("Update Successfull");
  } catch (err) {
    res.status(400).send(err.message);
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
