import { Router } from "express";
import userAuth from "../middleware/auth.middleware.js";
import isAdmin from "../middleware/isAdmin.middleware.js";
import { Job } from "../model/Job.model.js";
import mongoose from "mongoose";
import { Shipment } from "../model/Shipment.model.js";
import createAuditLog from "../utils/createAuditLog.js";
const shipmentRouter = Router();

//shipment
shipmentRouter.post(
  "/api/jobs/:id/shipment",
  userAuth,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { trackingId, networkName: bodyNetworkName } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send("Invalid job id");
      }

      const jobData = await Job.findById(id);
      if (!jobData) {
        return res.status(404).json({ message: "Job not found" });
      }
      if (
        !jobData.receiverName ||
        !jobData.receiverAddress ||
        !jobData.receiverNumber ||
        !jobData.receiverCity ||
        !jobData.receiverZipCode
      ) {
        return res
          .status(400)
          .json({ message: "Please add receiver details before proceeding" });
      }
      const networkName = (
        jobData.networkName || bodyNetworkName
      )?.toUpperCase();

      if (!networkName) {
        return res.status(400).json({ message: "Network name is required" });
      }
      if (!trackingId) {
        return res.status(400).json({ message: "Tracking ID is required" });
      }

      const shipment = await Shipment.create({
        jobId: id,
        networkName,
        trackingId,
      });

      await Job.findByIdAndUpdate(id, {
        status: "Dispatched",
        dispatchedAt: new Date(),
      });
      createAuditLog({
        jobId: id,
        actorId: req.user.id,
        actorRole: req.user.role,
        action: "jobDispatched",
        previousStatus: jobData.status,
        newStatus: "dispatched",
      });
      res
        .status(201)
        .json({ message: "Shipment recorded, job dispatched", shipment });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Something went wrong", error: error.message });
    }
  },
);

export default shipmentRouter;
