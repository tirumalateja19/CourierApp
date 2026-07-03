import { Router } from "express";
import userAuth from "../middleware/auth.middleware.js";
import Admin from "../model/Admin.model.js";
import validateNewPassword from "../utils/validations.js";
import bcrypt from "bcrypt";
const authRouter = Router();

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

export default authRouter;
