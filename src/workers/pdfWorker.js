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

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Old jobs have no actualWeight/volWeight, so show a dash instead of a wrong number
const fmtKg = (n) =>
  n === undefined || n === null || Number.isNaN(Number(n))
    ? "—"
    : Number(n).toFixed(2);

const fmtDims = (p) =>
  `${p.length} × ${p.breadth} × ${p.height} ${p.unit === "in" ? "in" : "cm"}`;

// Items belong to a box by packageId; old/orphaned items fall into Box 1
const groupItemsByBox = (packages, items) => {
  const ids = new Set(packages.map((p) => String(p._id)));
  return packages.map((pkg, i) =>
    items.filter(
      (it) =>
        String(it.packageId) === String(pkg._id) ||
        (i === 0 && !ids.has(String(it.packageId))),
    ),
  );
};

// Page 1 table: one row per box
const buildPackagesRows = (packages) => {
  let total = 0;
  const rows = packages
    .map((pkg, i) => {
      total += Number(pkg.weight) || 0; // weight = chargeable
      return `
    <tr>
      <td>Box ${i + 1}</td>
      <td>${fmtDims(pkg)}</td>
      <td class="text-right">${fmtKg(pkg.actualWeight)}</td>
      <td class="text-right">${fmtKg(pkg.volWeight)}</td>
      <td class="text-right">${fmtKg(pkg.weight)}</td>
    </tr>`;
    })
    .join("");
  return { rows, totalWeight: total.toFixed(2) };
};

// Page 3: one block per box with its own items
const buildBoxSections = (packages, items) => {
  const grouped = groupItemsByBox(packages, items);
  return packages
    .map((pkg, i) => {
      const itemRows =
        grouped[i]
          .map(
            (it) => `
        <tr>
          <td>${escapeHtml(it.itemName)}</td>
          <td>${it.quantity}</td>
          <td>${it.fragile ? "Yes" : "No"}</td>
        </tr>`,
          )
          .join("") || `<tr><td colspan="3">No items</td></tr>`;

      return `
    <div class="box-block">
      <div class="box-title">
        <span>Box ${i + 1}</span>
        <span>${fmtDims(pkg)}</span>
      </div>
      <div class="box-weights">
        Actual: <b>${fmtKg(pkg.actualWeight)} kg</b> &nbsp;|&nbsp;
        Volumetric: <b>${fmtKg(pkg.volWeight)} kg</b> &nbsp;|&nbsp;
        Charge: <b>${fmtKg(pkg.weight)} kg</b>
      </div>
      <table>
        <tr>
          <th>Item Name</th>
          <th style="width:100px;">Quantity</th>
          <th style="width:100px;">Fragile</th>
        </tr>
        ${itemRows}
      </table>
    </div>`;
    })
    .join("");
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
          packageId: i.packageId ? i.packageId.toString() : null,
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
      const boxSections = buildBoxSections(jobData.packages, items);

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
          boxSections,
          packagesRows,
          totalWeight,
          numberOfPackages: jobData.packages.length,
          packages: jobData.packages.length,
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
