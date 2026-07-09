import { Router } from "express";
import userAuth from "../middleware/auth.middleware";
import isAdmin from "../middleware/isAdmin.middleware";
import { Job } from "../model/Job.model";
import mongoose from "mongoose";
import { Shipment } from "../model/Shipment.model";
import createAuditLog from "../utils/createAuditLog";
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

      await Job.findByIdAndUpdate(id, { status: "dispatched" });
      
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
