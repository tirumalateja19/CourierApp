import { Router } from "express";
import Partner from "../model/Partner.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Job } from "../model/Job.model.js";
import userAuth from "../middleware/auth.middleware.js";
import verifyPartnerAccess from "../middleware/verifyPartnerAccess.middleware.js";
import { JobItem } from "../model/JobItem.model.js";

const partnerRouter = Router();

//partner login
partnerRouter.post("/api/partner/login", async (req, res) => {
  try {
    const { userName, password } = req.body;
    const user = await Partner.findOne({ userName: userName });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (user.isDeactivated) {
      return res.status(403).json({ message: "Access denied" });
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

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
    });

    res.status(200).json({
      message: "Login successful",
      user: { id: user._id, userName: user.userName, role: "partner" },
    });
  } catch (err) {
    res.status(400).send(err.message);
  }
});

//partner-jobs
partnerRouter.get("/api/partner/jobs", userAuth, async (req, res) => {
  try {
    const { status, fromDate, toDate, clientName } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { assignedToId: req.user.id }; // always scoped to this partner

    if (status === "Open") {
      filter.status = { $in: ["Created", "Assigned", "PickedUp", "AtOffice"] };
    } else if (status === "Completed") {
      filter.status = { $in: ["Dispatched"] };
    } else if (status) {
      filter.status = status;
    }

    if (clientName) filter.clientName = { $regex: clientName, $options: "i" };

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    const [jobs, totalCount] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Job.countDocuments(filter),
    ]);

    res.status(200).json({
      message: "Fetched Successfully",
      jobs,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

//partner stats
partnerRouter.get("/api/partner/jobs/stats", userAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const match = { assignedToId: req.user.id }; 
    
    if (fromDate || toDate) {
      match.createdAt = {};
      if (fromDate) match.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        match.createdAt.$lte = endOfDay;
      }
    }

    const OPEN_STATUSES = ["Created", "Assigned", "PickedUp", "AtOffice"];

    const [totalJobs, open, completed, cancelled] = await Promise.all([
      Job.countDocuments(match),
      Job.countDocuments({ ...match, status: { $in: OPEN_STATUSES } }),
      Job.countDocuments({ ...match, status: "Dispatched" }),
      Job.countDocuments({ ...match, status: "Cancelled" }),
    ]);

    res.status(200).json({
      message: "Partner Stats Fetched Successfully",
      totalJobs,
      open,
      completed,
      cancelled,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

//get specific job
partnerRouter.get(
  "/api/partner/jobs/:id",
  userAuth,
  verifyPartnerAccess,
  async (req, res) => {
    try {
      const { id } = req.params; //job id
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send("Invalid");
      }
      const jobData = await Job.findById(id);
      if (!jobData) {
        res.status(404).json({ message: "Job not found" });
      }
      const items = await JobItem.find({ jobId: id });
      res
        .status(200)
        .json({ message: "Job Fetch Successfull", jobData, items });
    } catch (error) {
      res.status(400).json({ error: err.message });
    }
  },
);

export default partnerRouter;
