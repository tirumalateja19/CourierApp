import { Router } from "express";
import mongoose from "mongoose";
import userAuth from "../middleware/auth.middleware.js";
import verifyPartnerAccess from "../middleware/verifyPartnerAccess.middleware.js";
import { JobItem } from "../model/JobItem.model.js";
import { Job } from "../model/Job.model.js";
const pickupRouter = Router();

//add details
pickupRouter.patch(
  "/api/jobs/pickup/:id/details",
  userAuth,
  verifyPartnerAccess,
  async (req, res) => {
    try {
      const { id } = req.params; //job id
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send("Invalid");
      }
      const {
        receiverName,
        receiverNumber,
        receiverAddress,
        weight,
        dimensions,
        packingStatus,
        status,
      } = req.body;
      const updates = {};
      if (receiverName !== undefined) updates.receiverName = receiverName;
      if (receiverNumber !== undefined) updates.receiverNumber = receiverNumber;
      if (receiverAddress !== undefined)
        updates.receiverAddress = receiverAddress;
      if (weight !== undefined) updates.weight = weight;
      if (dimensions !== undefined) updates.dimensions = dimensions;
      if (packingStatus !== undefined) updates.packingStatus = packingStatus;
      if (status !== undefined) updates.status = status;

      const jobData = await Job.findByIdAndUpdate(id, updates, {
        returnDocument: "after",
        runValidators: true,
      });

      if (!jobData) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.status(200).json({ message: "Details added!!", jobData });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Something went wrong", error: error.message });
    }
  },
);

//add items
pickupRouter.post(
  "/api/jobs/pickup/:id/items",
  userAuth,
  verifyPartnerAccess,
  async (req, res) => {
    try {
      const { id } = req.params; // job id
      const { itemName, quantity, fragile } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send("Invalid job id");
      }

      const item = await JobItem.create({
        jobId: id,
        itemName,
        quantity,
        fragile,
      });

      res.status(201).json({ message: "Item added", item });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Something went wrong", error: error.message });
    }
  },
);

//edit items
pickupRouter.patch(
  "/api/jobs/pickup/:id/items/:itemId",
  userAuth,
  verifyPartnerAccess,
  async (req, res) => {
    try {
      const { id, itemId } = req.params;
      const { itemName, quantity, fragile } = req.body;
      const updatedItem = await JobItem.findOneAndUpdate(
        { _id: itemId, jobId: id },
        { itemName: itemName, quantity: quantity, fragile: fragile },
        { returnDocument: "after", runValidators: true },
      );

      if (!updatedItem) {
        return res.status(404).json({ message: "Item not found for this job" });
      }
      res.status(200).json({ message: "Item edited", updatedItem });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Something went wrong", error: error.message });
    }
  },
);

//deleted items
pickupRouter.delete(
  "/api/jobs/pickup/:id/items/:itemId",
  userAuth,
  verifyPartnerAccess,
  async (req, res) => {
    try {
      const { id, itemId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send("Invalid");
      }
      if (!mongoose.Types.ObjectId.isValid(itemId)) {
        return res.status(400).send("Invalid");
      }
      const deletedItem = await JobItem.findOneAndDelete({
        _id: itemId,
        jobId: id,
      });

      if (!deletedItem) {
        return res.status(404).json({ message: "Item not found for this job" });
      }
      res.status(200).json({ message: "Item deleted successfully" });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Something went wrong", error: error.message });
    }
  },
);

export default pickupRouter;
