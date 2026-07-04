import { Router } from "express";
import Partner from "../model/Partner.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const partnerRouter = Router();

//partner login
partnerRouter.post("/api/partner/login", async (req, res) => {
  try {
    const { userName, password } = req.body;
    const user = await Partner.findOne({ userName: userName });
    if (!user) {
      throw new Error("Incorrect UserName or Password");
    }
    if (user.isDeactivated) {
      throw new Error("Cannot access the account, contact admin");
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).send("Invalid credentials");
    }

    const token = jwt.sign(
      { id: user._id, userName: user.userName, role: "partner" },
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
    res.status(400).send(err.message);
  }
});

export default partnerRouter;
