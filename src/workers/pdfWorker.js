import { Worker } from "bullmq";
import puppeteerCore from "puppeteer-core";
import standardPuppeteer from "puppeteer";
import chromium from "@sparticuz/chromium";
import connection from "../config/redis.js";
import cloudinary from "../config/cloudinary.js";
import renderTemplate from "../utils/renderTemplate.js";
import ClientInvoice from "../model/ClientInvoice.model.js";
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
        public_id: `invoice_${Date.now()}.pdf`,
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
    return await standardPuppeteer.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
  }
};

const pdfWorker = new Worker(
  "pdf-generation",
  async (job) => {
    if (job.name === "generate-invoice") {
      const { jobId, generatedById, generatedByRole, generatedByName } =
        job.data;

      const jobData = await Job.findById(jobId);
      if (!jobData) throw new Error("Job not found");

      const { rows: packagesRows, totalWeight } = buildPackagesRows(
        jobData.packages,
      );

      const isAdmin = generatedByRole === "admin";
      const hasPrice =
        jobData.price &&
        jobData.price.trim() !== "" &&
        jobData.price.trim() !== "0";

      const displayTotal =
        isAdmin && hasPrice ? `₹ ${jobData.price}` : "PENDING";

      const html = renderTemplate(
        path.resolve("uploads/templates/invoice_template.html"),
        {
          cell: process.env.CELL,
          email: process.env.EMAIL,
          senderName: jobData.clientName,
          senderPhone: jobData.clientNumber,
          senderAddress: jobData.clientAddress,
          senderCity: jobData.clientCity,
          receiverName: jobData.receiverName,
          receiverPhone: jobData.receiverNumber,
          receiverAddress: jobData.receiverAddress,
          receiverCity: jobData.receiverCity,
          zipCode: jobData.receiverZipCode,
          referenceNo: jobId,
          packagesRows,
          totalWeight,
          packages: jobData.numberOfPackages,
          guidelines:
            "Please handle with care. Do not bend or crush the package.",
          total: displayTotal,
          pickupName: generatedByName,
          pickupId: generatedById,
        },
      );

      const browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
      await browser.close();

      const uploadResult = await uploadPdfToCloudinary(
        pdfBuffer,
        "pickitup/invoices",
      );

      await ClientInvoice.create({
        jobId,
        generatedById,
        generatedByRole,
        price: jobData.price,
        pdfUrl: uploadResult.secure_url,
      });

      createAuditLog({
        jobId,
        actorRole: "system",
        action: "pdfGenerated",
      });

      console.log(`Invoice generated for job ${jobId}`);
    }

    if (job.name === "generate-pod-slip") {
      const { jobId, generatedById } = job.data;

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

      await PodSlip.create({
        jobId,
        generatedById,
        pdfUrl: uploadResult.secure_url,
        pdfHash,
      });

      createAuditLog({
        jobId,
        actorRole: "system",
        action: "pdfGenerated",
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
