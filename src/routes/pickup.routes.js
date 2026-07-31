import { Router } from "express";
import mongoose from "mongoose";
import userAuth from "../middleware/auth.middleware.js";
import verifyPartnerAccess from "../middleware/verifyPartnerAccess.middleware.js";
import { JobItem } from "../model/JobItem.model.js";
import { Job } from "../model/Job.model.js";
import ClientInvoice from "../model/ClientInvoice.model.js";
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

//submit - generating invoice and pod-slip
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

      const existingInvoice = await ClientInvoice.findOne({ jobId: id }).sort({
        createdAt: -1,
      });
      if (existingInvoice && jobData.updatedAt <= existingInvoice.createdAt) {
        return res
          .status(400)
          .json({ message: "No changes detected since last generation" });
      }

      if (!jobData.packages || jobData.packages.length === 0) {
        return res.status(400).json({
          message: "Please add package details before proceeding",
        });
      }

      const missingWeight = jobData.packages.some((pkg) => !pkg.weight);
      if (missingWeight || !jobData.price) {
        return res.status(400).json({
          message:
            "Weight for every package and price are required to submit. Use defer-invoice if unavailable.",
        });
      }
      await Job.findByIdAndUpdate(id, {
        invoiceStatus: "generated_at_pickup",
        status: "PickedUp",
      });
      await pdfQueue.add(
        "generate-invoice",
        {
          jobId: id,
          generatedById: req.user.id,
          generatedByRole: req.user.role,
          generatedByName: req.user.userName,
        },
        {
          jobId: `invoice-${id}`,
          removeOnComplete: true,
        },
      );
      await pdfQueue.add(
        "generate-pod-slip",
        {
          jobId: id,
          generatedById: req.user.id,
        },
        {
          jobId: `pod-${id}`,
          removeOnComplete: true,
        },
      );

      res.status(200).json({ message: "Job submitted, PDFs generating" });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Something went wrong", error: error.message });
    }
  },
);

//generating pod-slip
pickupRouter.post(
  "/api/jobs/pickup/:id/defer-invoice",
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
        invoiceStatus: "pending_office_completion",
        status: "AtOffice",
      });
      await pdfQueue.add(
        "generate-pod-slip",
        {
          jobId: id,
          generatedById: req.user.id,
        },
        {
          jobId: `pod-${id}`,
          removeOnComplete: true,
        },
      );

      res
        .status(200)
        .json({ message: "Pod slip generating, invoice deferred to admin" });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Something went wrong", error: error.message });
    }
  },
);

export default pickupRouter;
