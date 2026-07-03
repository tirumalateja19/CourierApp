import { Router } from "express";
import Admin from "../model/Admin.model.js";
import Partner from "../model/Partner.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userAuth from "../middleware/auth.middleware.js";

const adminRouter = Router();

adminRouter.post("/api/admin/login", async (req, res) => {
  try {
    const { userName, password } = req.body;

    const user = await Admin.findOne({ userName: userName });
    if (!user) {
      throw new Error("Incorrect UserName or Password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).send("Invalid credentials");
    }

    const token = jwt.sign(
      { id: user._id, userName: user.userName },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
    });

    res.status(200).send("Login successful");
  } catch (err) {
    res.status(401).send(err.message);
  }
});

adminRouter.get("/api/admin/data", userAuth, (req, res) => {
  try {
    const user = req.admin;
    res.send(user);
  } catch (err) {
    res.status(401).send(err.message);
  }
});
export default adminRouter;
