import { Worker } from "bullmq";
import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import connection from "../config/redis.js";
import cloudinary from "../config/cloudinary.js";
import renderTemplate from "../utils/renderTemplate.js";
import path from "path";
import crypto from "crypto";
import { PodSlip } from "../model/PodSlip.model.js";
import { Job } from "../model/Job.model.js";
import { JobItem } from "../model/JobItem.model.js";
import { JobPhoto } from "../model/JobPhoto.model.js";
import createAuditLog from "../utils/createAuditLog.js";

const uploadPdfToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder,
        public_id: `podslip_${Date.now()}.pdf`,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    stream.end(buffer);
  });
};

const buildPackagesRows = (packages) => {
  let totalWeight = 0;

  const rows = packages
    .map((pkg, index) => {
      totalWeight += Number(pkg.weight) || 0;
      return `
    <tr>
      <td>Package ${index + 1}</td>
      <td class="text-right">${pkg.weight} kg</td>
    </tr>
  `;
    })
    .join("");

  return { rows, totalWeight: totalWeight.toFixed(2) };
};

const launchBrowser = async () => {
  const isRender = process.env.RENDER === "true";

  if (isRender) {
    console.log(
      "[pdfWorker] Launching browser via @sparticuz/chromium (Render)",
    );
    return await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  } else {
    console.log("[pdfWorker] Launching browser via standard puppeteer (local)");
    const { default: standardPuppeteer } = await import("puppeteer");
    return await standardPuppeteer.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
  }
};

const pdfWorker = new Worker(
  "pdf-generation",
  async (job) => {
    if (job.name === "generate-pod-slip") {
      const { jobId, generatedById, generatedByUsername, actorRole } = job.data;

      const jobData = await Job.findById(jobId);
      if (!jobData) throw new Error("Job not found");

      const items = await JobItem.find({ jobId }).sort({ createdAt: 1 });
      const photos = await JobPhoto.find({ jobId }).sort({ createdAt: 1 });

      const sourceData = {
        receiverName: jobData.receiverName,
        receiverAddress: jobData.receiverAddress,
        receiverCity: jobData.receiverCity,
        receiverZipCode: jobData.receiverZipCode,
        receiverNumber: jobData.receiverNumber,
        price: jobData.price,
        packages: jobData.packages,
        numberOfPackages: jobData.numberOfPackages,
        items: items.map((i) => ({
          name: i.itemName,
          qty: i.quantity,
          fragile: i.fragile,
        })),
        photoIds: photos.map((p) => p._id.toString()),
      };

      const sourceHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(sourceData))
        .digest("hex");

      const existingPodSlip = await PodSlip.findOne({ jobId }).sort({
        createdAt: -1,
      });

      if (existingPodSlip && existingPodSlip.sourceHash === sourceHash) {
        await Job.findByIdAndUpdate(jobId, {
          podSlipStatus: "unchanged",
        });
        console.log(
          `[pdfWorker] No content change for job ${jobId}, skipping regeneration`,
        );
        return;
      }

      const { rows: packagesRows, totalWeight } = buildPackagesRows(
        jobData.packages,
      );

      const itemRows = items
        .map(
          (item) => `
    <tr>
      <td>${item.itemName}</td>
      <td>${item.quantity}</td>
      <td>${item.fragile ? "Yes" : "No"}</td>
    </tr>
  `,
        )
        .join("");

      const photoPages = photos
        .map(
          (photo) => `
    <div class="page photo-page">
      <img src="${photo.fileUrl}" />
      <div class="photo-caption">${photo.label}</div>
    </div>
  `,
        )
        .join("");

      const hasValidPrice =
        jobData.price &&
        jobData.price.toString().trim() !== "" &&
        jobData.price.toString().trim() !== "0" &&
        jobData.price.toString().trim() !== "1";

      const displayTotal = hasValidPrice ? `₹ ${jobData.price}` : "PENDING";

      const html = renderTemplate(
        path.resolve("uploads/templates/template.html"),
        {
          jobId,
          senderName: jobData.clientName,
          senderAddress: jobData.clientAddress,
          senderCity: jobData.clientCity,
          senderPhone: jobData.clientNumber,
          receiverName: jobData.receiverName,
          receiverAddress: jobData.receiverAddress,
          receiverCity: jobData.receiverCity,
          receiverZipCode: jobData.receiverZipCode,
          receiverPhone: jobData.receiverNumber,
          itemRows,
          packagesRows,
          totalWeight,
          numberOfPackages: jobData.numberOfPackages,
          packages: jobData.numberOfPackages,
          photoPages,
          total: displayTotal,
          cell: process.env.CELL,
          email: process.env.EMAIL,
          guidelines: process.env.HANDLING_GUIDELINES,
          referenceNo: jobId,
          pickupName: generatedByUsername,
          pickupId: generatedById,
        },
      );

      let pdfBuffer;
      try {
        const browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 900, height: 1200 });
        await page.setContent(html, { waitUntil: "networkidle0" });
        pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
        await browser.close();
      } catch (err) {
        await Job.findByIdAndUpdate(jobId, { podSlipStatus: "failed" });
        throw err;
      }

      const pdfHash = crypto
        .createHash("sha256")
        .update(pdfBuffer)
        .digest("hex");

      let uploadResult;
      try {
        uploadResult = await uploadPdfToCloudinary(
          pdfBuffer,
          "pickitup/podslips",
        );
      } catch (err) {
        await Job.findByIdAndUpdate(jobId, { podSlipStatus: "failed" });
        throw err;
      }

      await PodSlip.findOneAndUpdate(
        { jobId },
        {
          jobId,
          generatedById,
          pdfUrl: uploadResult.secure_url,
          pdfHash,
          sourceHash,
        },
        { upsert: true, returnDocument: "after" },
      );

      await Job.findByIdAndUpdate(jobId, {
        podSlipGenerated: true,
        podGeneratedBy: generatedByUsername,
        podSlipStatus: "ready",
      });

      createAuditLog({
        jobId,
        actorId: generatedById,
        actorName: generatedByUsername,
        actorRole,
        action: "podSlipGenerated",
      });

      console.log(`Pod slip generated for job ${jobId}`);
    }
  },
  { connection },
);

pdfWorker.on("completed", (job) =>
  console.log(`Job ${job.id} (${job.name}) completed`),
);
pdfWorker.on("failed", (job, err) =>
  console.error(`Job ${job.id} (${job.name}) failed:`, err.message),
);

export default pdfWorker;
