import { Router } from "express";
import mongoose from "mongoose";
import userAuth from "../middleware/auth.middleware.js";
import verifyPartnerAccess from "../middleware/verifyPartnerAccess.middleware.js";
import { JobItem } from "../model/JobItem.model.js";
import { Job } from "../model/Job.model.js";
import upload from "../config/multer.js";
import { JobPhoto } from "../model/JobPhoto.model.js";
import pdfQueue from "../queues/pdfQueue.js";
import createAuditLog from "../utils/createAuditLog.js";
import { PodSlip } from "../model/PodSlip.model.js";
const pickupRouter = Router();

//add details
pickupRouter.patch(
  "/api/jobs/pickup/:id/details",
  userAuth,
  verifyPartnerAccess,
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send("Invalid");
      }
      const {
        receiverName,
        receiverNumber,
        receiverAddress,
        packages,
        packingStatus,
        status,
        price,
        numberOfPackages,
        receiverCity,
        receiverZipCode,
        receiverCountry,
      } = req.body;

      const updates = {};
      if (receiverName !== undefined) updates.receiverName = receiverName;
      if (receiverNumber !== undefined) updates.receiverNumber = receiverNumber;
      if (receiverAddress !== undefined)
        updates.receiverAddress = receiverAddress;
      if (packages !== undefined) updates.packages = packages;
      if (price !== undefined) updates.price = price;
      if (packingStatus !== undefined) updates.packingStatus = packingStatus;
      if (status !== undefined) updates.status = status;
      if (numberOfPackages !== undefined)
        updates.numberOfPackages = numberOfPackages;
      if (receiverCity !== undefined) updates.receiverCity = receiverCity;
      if (receiverZipCode !== undefined)
        updates.receiverZipCode = receiverZipCode;
      if (receiverCountry !== undefined)
        updates.receiverCountry = receiverCountry;

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
      createAuditLog({
        jobId: id,
        actorId: req.user.id,
        actorRole: req.user.role,
        actorName: req.user.userName,
        action: "itemsEdited",
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
      createAuditLog({
        jobId: id,
        actorId: req.user.id,
        actorRole: req.user.role,
        actorName: req.user.userName,
        action: "itemsEdited",
      });
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
      createAuditLog({
        jobId: id,
        actorId: req.user.id,
        actorRole: req.user.role,
        actorName: req.user.userName,
        action: "itemsEdited",
      });
      res.status(200).json({ message: "Item deleted successfully" });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Something went wrong", error: error.message });
    }
  },
);

//upload photo
pickupRouter.post(
  "/api/jobs/pickup/:id/photos",
  userAuth,
  verifyPartnerAccess,
  upload.single("photo"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { label } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const validLabels = [
        "id_proof",
        "waybill",
        "invoice",
        "packed_box",
        "item_evidence",
      ];
      if (!validLabels.includes(label)) {
        return res.status(400).json({ message: "Invalid label" });
      }

      const photo = await JobPhoto.create({
        jobId: id,
        label,
        fileUrl: req.file.path, // Cloudinary gives back the hosted URL here
      });

      res.status(201).json({ message: "Photo uploaded successfully", photo });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Something went wrong", error: error.message });
    }
  },
);

//generating pod-slip
pickupRouter.post(
  "/api/jobs/pickup/:id/submit",
  userAuth,
  verifyPartnerAccess,
  async (req, res) => {
    try {
      const { id } = req.params;

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

      const existingPodSlip = await PodSlip.findOne({ jobId: id }).sort({
        createdAt: -1,
      });

      if (existingPodSlip && jobData.updatedAt <= existingPodSlip.createdAt) {
        return res
          .status(400)
          .json({ message: "No changes detected since last generation" });
      }

      await Job.findByIdAndUpdate(id, {
        status: "AtOffice",
      });

      await pdfQueue.add(
        "generate-pod-slip",
        {
          jobId: id,
          generatedById: req.user.id,
          generatedByUsername: req.user.userName,
          actorRole: req.user.role,
        },
        {
          jobId: `pod-slip-${id}`,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );

      res.status(200).json({ message: "Pod slip generating" });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Something went wrong", error: error.message });
    }
  },
);

export default pickupRouter;
