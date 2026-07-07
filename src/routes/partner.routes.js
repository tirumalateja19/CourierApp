import { Router } from "express";
import Partner from "../model/Partner.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Job } from "../model/Job.model.js";
import userAuth from "../middleware/auth.middleware.js";
import verifyPartnerAccess from "../middleware/verifyPartnerAccess.middleware.js";

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

//partner-jobs
partnerRouter.get("/api/partner/jobs", userAuth, async (req, res) => {
  try {
    const { status, fromDate, toDate } = req.query;

    const filter = { assignedToId: req.user.id }; // always scoped to this partner
    if (status) filter.status = status;
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    const jobs = await Job.find(filter);
    res.status(200).json({ message: "Fetched Successfully", jobs });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

//get specific job
partnerRouter.get("/api/partner/jobs/:id", userAuth,verifyPartnerAccess, async (req, res) => {
  try {
    const { id } = req.params; //job id
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send("Invalid");
    }
    const data = await Job.findById(id);
    if (!data) {
      res.status(404).json({ message: "Job not found" });
    }
    res.status(200).json({ message: "Found Job", data });
  } catch (error) {
    res.status(400).json({ error: err.message });
  }
});

export default partnerRouter;
