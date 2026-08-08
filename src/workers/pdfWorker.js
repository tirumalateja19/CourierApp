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

      const items = await JobItem.find({ jobId });
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

      const photos = await JobPhoto.find({ jobId });
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
        path.resolve("uploads/templates/podslip_template.html"),
        {
          jobId,
          clientName: jobData.clientName,
          clientAddress: jobData.clientAddress,
          clientCity: jobData.clientCity,
          clientNumber: jobData.clientNumber,
          receiverName: jobData.receiverName,
          receiverAddress: jobData.receiverAddress,
          receiverCity: jobData.receiverCity,
          receiverZipCode: jobData.receiverZipCode,
          receiverNumber: jobData.receiverNumber,
          itemRows,
          packagesRows,
          totalWeight,
          numberOfPackages: jobData.numberOfPackages,
          photoPages,
          total: displayTotal,
        },
      );

      const browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setViewport({ width: 900, height: 1200 });
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
      await browser.close();

      const pdfHash = crypto
        .createHash("sha256")
        .update(pdfBuffer)
        .digest("hex");

      const uploadResult = await uploadPdfToCloudinary(
        pdfBuffer,
        "pickitup/podslips",
      );

      await PodSlip.findOneAndUpdate(
        { jobId },
        {
          jobId,
          generatedById,
          pdfUrl: uploadResult.secure_url,
          pdfHash,
        },
        { upsert: true, returnDocument: "after" },
      );

      await Job.findByIdAndUpdate(jobId, {
        podSlipGenerated: true,
        podGeneratedBy: generatedByUsername,
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
