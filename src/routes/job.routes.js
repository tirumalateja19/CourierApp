import { Router } from "express";
import userAuth from "../middleware/auth.middleware.js";
import isAdmin from "../middleware/isAdmin.middleware.js";
import { Job } from "../model/Job.model.js";
import mongoose from "mongoose";
import Partner from "../model/Partner.model.js";
import createAuditLog from "../utils/createAuditLog.js";
import { JobItem } from "../model/JobItem.model.js";
const jobRouter = Router();

//create new-job
jobRouter.post("/api/jobs/new-job", userAuth, isAdmin, async (req, res) => {
  try {
    const {
      clientName,
      clientNumber,
      clientAddress,
      approxWeight,
      scheduledTime,
      status,
    } = req.body;
    const job = new Job({
      clientName: clientName,
      clientNumber: clientNumber,
      clientAddress: clientAddress,
      approxWeight: approxWeight,
      scheduledTime: scheduledTime,
      status: status,
    });
    await job.save();
    res.status(201).json({ message: "Job created successfully" });
  } catch (err) {
    res.status(400).send(err.message);
  }
});

//all jobs
jobRouter.get("/api/jobs", userAuth, isAdmin, async (req, res) => {
  try {
    const { status, assignedToId, fromDate, toDate } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (assignedToId) filter.assignedToId = assignedToId;
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    const totalJobs = await Job.find(filter);
    res.status(200).json({ message: "Fetched Successfully", totalJobs });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

//assign-partner
jobRouter.patch("/api/jobs/:id/assign", userAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params; //jobId
    const { partnerId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send("Invalid job");
    }
    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).send("Invalid partner");
    }
    const partnerData = await Partner.findById(partnerId);
    if (!partnerData) {
      return res.status(404).json({ message: "Partner not found" });
    }
    if (partnerData.isDeactivated) {
      return res
        .status(406)
        .json({ message: "Cannot assign, Partner deactivated!" });
    }
    const job = await Job.findByIdAndUpdate(
      id,
      {
        assignedToId: partnerId,
        assignedToRole: "partner",
        assignedTo: partnerData.userName,
        status: "assigned",
      },
      { returnDocument: "after" },
    );
    if (!job) {
      return res.status(400).json({ message: "Job not found" });
    }

    res.status(200).json({ message: "Job Assigned Successfully", job });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Something went wrong", error: error.message });
  }
});

//self-assign
jobRouter.patch(
  "/api/jobs/:id/self-assign",
  userAuth,
  isAdmin,
  async (req, res) => {
    try {
      const adminId = req.user.id; //adminId
      const adminName = req.user.userName;
      const { id } = req.params; //jobId

      if (!mongoose.Types.ObjectId.isValid(adminId)) {
        return res.status(400).send("Invalid admin");
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send("Invalid job");
      }

      const job = await Job.findByIdAndUpdate(
        id,
        {
          assignedToId: adminId,
          assignedToRole: "admin",
          assignedTo: adminName,
          status: "assigned",
        },
        { returnDocument: "after" },
      );

      if (!job) {
        return res.status(400).json({ message: "Job not found" });
      }

      res.status(200).json({ message: "Job Assigned Successfully", job });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Something went wrong", error: error.message });
    }
  },
);

//current job
jobRouter.get("/api/jobs/:id", userAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params; //jobId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send("Invalid");
    }
    const jobData = await Job.findById(id);
    if (!jobData) {
      return res.status(404).json({ message: "Job not found" });
    }
    const items = await JobItem.find({ jobId: id });
    res.status(200).json({ message: "Job Fetch Successfull", jobData, items });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Something went wrong", error: error.message });
  }
});

//change-status
jobRouter.patch("/api/jobs/:id/status", userAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params; //job_id
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send("Invalid job");
    }
    const updateJob = await Job.findByIdAndUpdate(
      id,
      { status: status },
      { returnDocument: "after" },
    );
    if (!updateJob) {
      return res.status(400).json({ message: "Job not found" });
    }

    res.status(200).json({ message: "Job Assigned Successfully", updateJob });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Something went wrong", error: error.message });
  }
});

//lock-job
jobRouter.patch("/api/jobs/:id/lock", userAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { lockedReason } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send("Invalid");
    }
    const jobData = await Job.findById(id);
    if (!jobData) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (jobData.assignedToRole === "admin") {
      return res.status(406).json({ message: "Cannot lock your job" });
    }
    if (jobData.locked) {
      return res.status(200).json({ message: "Job's already locked", jobData });
    }
    const lockedJob = await Job.findByIdAndUpdate(
      id,
      { locked: true, lockedAt: new Date(), lockedReason: lockedReason },
      { returnDocument: "after" },
    );
    createAuditLog({
      jobId: id,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: "jobLocked",
      previousStatus: undefined, // or "unlocked" if you decide to track it as a pseudo-status
      newStatus: undefined, // same
    });
    res.status(200).json({ message: "Job locked successfully", lockedJob });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Something went wrong", error: error.message });
  }
});

//unlock-job
jobRouter.patch("/api/jobs/:id/unlock", userAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id; //job id
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send("Invalid");
    }
    const jobData = await Job.findById(id);
    if (!jobData) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (jobData.locked === false) {
      return res
        .status(200)
        .json({ message: "Job's already unLocked", jobData });
    }
    const unLockedJob = await Job.findByIdAndUpdate(
      id,
      {
        locked: false,
        unlockedBy: req.user.id,
        unlockedByAdminName: req.user.userName,
      },
      { returnDocument: "after" },
    );
    createAuditLog({
      jobId: id,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: "jobUnlocked",
    });
    res.status(200).json({ message: "Job unLocked successfully", unLockedJob });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Something went wrong", error: error.message });
  }
});

export default jobRouter;
