import { Router } from "express";
import Admin from "../model/Admin.model.js";
import Partner from "../model/Partner.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userAuth from "../middleware/auth.middleware.js";
import validateNewPassword from "../utils/validations.js";
import mongoose from "mongoose";
import isAdmin from "../middleware/isAdmin.middleware.js";

const adminRouter = Router();

//admin login
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
      { id: user._id, userName: user.userName, role: "admin" },
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

//create-partner
adminRouter.post(
  "/api/admin/create-partner",
  userAuth,
  isAdmin,
  async (req, res) => {
    try {
      const { userName, password, contactNumber, availableStatus } = req.body;
      const existing = await Partner.findOne({
        userName: userName,
      });
      if (existing) {
        throw new Error("Partner already exists");
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const partner = new Partner({
        userName: userName,
        password: passwordHash,
        contactNumber: contactNumber,
        availableStatus: availableStatus,
      });
      await partner.save();
      res.status(201).send("Partner created");
    } catch (err) {
      res.status(400).send(err.message);
    }
  },
);

//create-admin
adminRouter.post(
  "/api/admin/create-admin",
  userAuth,
  isAdmin,
  async (req, res) => {
    try {
      const { userName, password, contactNumber } = req.body;
      const existing = await Admin.findOne({
        userName: userName,
      });
      if (existing) {
        throw new Error("Admin already exists");
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const admin = new Admin({
        userName: userName,
        password: passwordHash,
        contactNumber: contactNumber,
      });
      await admin.save();
      res.status(201).send("Admin created");
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).send("Username already exists");
      }
      res.status(400).send(err.message);
    }
  },
);

//partners-data
adminRouter.get("/api/admin/partners", userAuth, isAdmin, async (req, res) => {
  try {
    const partners = await Partner.find({}).select("-password");
    res.status(200).json(partners);
  } catch (err) {
    res.status(500).send("Something went wrong");
  }
});

//deactivate-partner
adminRouter.patch(
  "/api/admin/partners/:id/deactivate",
  userAuth,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send("Invalid partner id");
      }
      const partner = await Partner.findByIdAndUpdate(
        id, // 1st arg: WHICH document to find
        { isDeactivated: true }, // 2nd arg: WHAT to change on it
        { returnDocument: "after" }, // 3rd arg:returns updated doc
      ).select("-password");

      if (!partner) {
        return res.status(404).send("Partner not found");
      }

      res.status(200).json({ message: "Partner deactivated", partner });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Something went wrong", error: err.message });
    }
  },
);

export default adminRouter;
