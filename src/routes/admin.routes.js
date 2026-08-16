import { Router } from "express";
import Admin from "../model/Admin.model.js";
import Partner from "../model/Partner.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userAuth from "../middleware/auth.middleware.js";
import validateNewPassword from "../utils/validations.js";
import mongoose from "mongoose";
import isAdmin from "../middleware/isAdmin.middleware.js";
import createAuditLog from "../utils/createAuditLog.js";
import AuditLog from "../model/AuditLog.model.js";
import { Job } from "../model/Job.model.js";

const adminRouter = Router();

//admin login
adminRouter.post("/api/admin/login", async (req, res) => {
  try {
    const { userName, password } = req.body;

    const user = await Admin.findOne({ userName: userName });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
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

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
    });

    res.status(200).json({
      message: "Login successful",
      user: { id: user._id, userName: user.userName, role: "admin" },
    });
  } catch (err) {
    res.status(401).json({ message: err.message });
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
      res.status(201).json({ message: "Partner Created", partner });
    } catch (err) {
      if (err.code === 11000) {
        return res
          .status(409)
          .json({ message: "Username/Contact already exists" });
      }
      res.status(400).json({ message: err.message });
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
      res.status(400).json({ message: err.message });
    }
  },
);

//partners-data
adminRouter.get("/api/admin/partners", userAuth, isAdmin, async (req, res) => {
  try {
    const partners = await Partner.find({}).select("-password");
    res.status(200).json({ message: "Fetched Successfully", partners });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong" });
  }
});

// admin stats
adminRouter.get("/api/admin/jobs/stats", userAuth, isAdmin, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const match = {}; 
    
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
      message: "Admin Stats Fetched Successfully",
      totalJobs,
      open,
      completed,
      cancelled,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
      createAuditLog({
        actorId: req.user.id,
        actorRole: req.user.role,
        actorName: req.user.userName,
        action: "partnerDeactivated",
        previousStatus: "active",
        newStatus: "inactive",
      });

      res.status(200).json({ message: "Partner deactivated", partner });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Something went wrong", error: err.message });
    }
  },
);

//activate partner
adminRouter.patch(
  "/api/admin/partners/:id/activate",
  userAuth,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send("Invalid partner id");
      }

      const partner = await Partner.findByIdAndUpdate(
        id,
        { isDeactivated: false },
        { returnDocument: "after" },
      ).select("-password");

      if (!partner) {
        return res.status(404).json({ message: "Partner not found" });
      }
      createAuditLog({
        actorId: req.user.id,
        actorRole: req.user.role,
        actorName: req.user.userName,
        action: "partnerActivated",
        previousStatus: "inactive",
        newStatus: "active",
      });
      res.status(200).json({ message: "Partner activated", partner });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Something went wrong", error: error.message });
    }
  },
);

//get audit job details
adminRouter.get(
  "/api/jobs/auditedJobs",
  userAuth,
  isAdmin,
  async (req, res) => {
    try {
      const { status, assignedToId, fromDate, toDate, clientName } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const filter = {};

      if (status === "Open") {
        filter.status = {
          $in: ["Created", "Assigned", "PickedUp", "AtOffice"],
        };
      } else if (status === "Completed") {
        filter.status = { $in: ["Dispatched"] };
      } else if (status) {
        filter.status = status;
      }

      if (assignedToId) filter.assignedToId = assignedToId;
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
  },
);

//get specific audit
adminRouter.get(
  "/api/admin/audit-logs/:jobId",
  userAuth,
  isAdmin,
  async (req, res) => {
    try {
      const { jobId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(jobId)) {
        return res.status(400).json({ message: "Invalid job id" });
      }

      const jobExists = await Job.findById(jobId);
      if (!jobExists) {
        return res.status(404).json({ message: "Job not found" });
      }

      const logs = await AuditLog.find({ jobId }).sort({ createdAt: 1 });

      res.status(200).json({ message: "Fetched audit logs", logs });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Something went wrong", error: error.message });
    }
  },
);

//get archived jobs
adminRouter.get("/api/jobs/archived", userAuth, isAdmin, async (req, res) => {
  try {
    const { assignedToId, fromDate, toDate, clientName } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { isArchived: true };
    if (assignedToId) filter.assignedToId = assignedToId;
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

//archive job
adminRouter.patch(
  "/api/jobs/:id/archive",
  userAuth,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      const jobData = await Job.findByIdAndUpdate(
        id,
        {
          isArchived: true,
          archivedAt: new Date(),
        },
        { runValidators: true, returnDocument: "after" },
      );

      if (!jobData) {
        return res.status(404).json({ message: "Job not found" });
      }

      createAuditLog({
        jobId: id,
        actorId: req.user.id,
        actorName: req.user.username,
        actorRole: req.user.role,
        action: "jobArchived",
      });

      res.status(200).json({ message: "Job archived", jobData });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

//unarchive job
adminRouter.patch(
  "/api/jobs/:id/unarchive",
  userAuth,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      const jobData = await Job.findByIdAndUpdate(
        id,
        {
          isArchived: false,
          archivedAt: null,
        },
        { runValidators: true, returnDocument: "after" },
      );

      if (!jobData) {
        return res.status(404).json({ message: "Job not found" });
      }

      createAuditLog({
        jobId: id,
        actorId: req.user.id,
        actorName: req.user.username,
        actorRole: req.user.role,
        action: "jobUnarchived",
      });

      res.status(200).json({ message: "Job unarchived", jobData });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

adminRouter.patch(
  "/api/admin/:id/cancel",
  userAuth,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { cancelledReason } = req.body;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send("Invalid");
      }
      const jobData = await Job.findById(id);
      if (!jobData) {
        return res.status(404).json({ message: "Job not found" });
      }
      if (jobData.cancelled) {
        return res
          .status(200)
          .json({ message: "Job's already Cancelled", jobData });
      }
      const canceledJob = await Job.findByIdAndUpdate(
        id,
        {
          cancelled: true,
          locked: true,
          cancelledAt: new Date(),
          cancelReason: cancelledReason,
          status: "Cancelled",
        },
        { returnDocument: "after" },
      );

      createAuditLog({
        jobId: id,
        actorId: req.user.id,
        actorRole: req.user.role,
        actorName: req.user.userName,
        action: "jobCancelled",
        previousStatus: jobData.status,
        newStatus: "Cancelled",
      });
      res
        .status(200)
        .json({ message: "Job Cancelled successfully", jobData: canceledJob });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Something went wrong", error: error.message });
    }
  },
);

export default adminRouter;
