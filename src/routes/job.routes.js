import { Router } from "express";
import userAuth from "../middleware/auth.middleware.js";
import isAdmin from "../middleware/isAdmin.middleware.js";
import { Job } from "../model/Job.model.js";
import mongoose from "mongoose";
import Partner from "../model/Partner.model.js";
const jobRouter = Router();

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

jobRouter.get("/api/jobs", userAuth, isAdmin, async (req, res) => {
  try {
    const totalJobs = await Job.find({});
    res.status(200).json({ message: "Fetched Successfully", totalJobs });
  } catch (err) {
    res.status(400).json({ error: req.message });
  }
});

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

jobRouter.get("/api/jobs/:id", userAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params; //jobId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send("Invalid");
    }
    const jobData = await Job.findById(id);
    if (!jobData) {
      return res.status(400).json({ message: "Job not found" });
    }
    res.status(200).json({ message: "Job Fetch Successfull", jobData });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Something went wrong", error: error.message });
  }
});

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
export default jobRouter;
