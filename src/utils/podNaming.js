import cloudinary from "../config/cloudinary.js";
import { PodCounter } from "../model/PodCounter.model.js";

const FOLDER = "pickitup/podslips";

// Date pieces in the business timezone (Render runs in UTC, so midnight would
// otherwise fall at the wrong hour). Set BUSINESS_TZ to an IANA name.
const getDateParts = (date = new Date()) => {
  const format = (timeZone) =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(date)
        .map((p) => [p.type, p.value]),
    );

  let p;
  try {
    p = format(process.env.BUSINESS_TZ || "UTC");
  } catch {
    p = format("UTC"); // invalid zone name in the env var
  }

  return {
    dayKey: `${p.year}-${p.month}-${p.day}`,
    stamp: `${p.year}${p.month}${p.day}-${p.hour}${p.minute}`,
  };
};

// Atomic counter: $inc on an upserted document, so two workers can never get
// the same number. If both try to create it at once, the loser retries once.
const nextSeq = async (key) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const doc = await PodCounter.findOneAndUpdate(
        { key },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after" },
      );
      return doc.seq;
    } catch (err) {
      if (err?.code !== 11000 || attempt === 1) throw err;
    }
  }
};

const cleanName = (name) =>
  String(name || "")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "partner";

// {partner}_{YYYYMMDD-HHmm}_{count}_v{version}.pdf
//   count   = nth PDF generated that day for that partner
//   version = nth time that job's PDF was generated that day
// Both restart from 1 each day.
export const buildPodFileName = async ({ partnerName, partnerId, jobId }) => {
  const { dayKey, stamp } = getDateParts();
  const partner = cleanName(partnerName);
  const partnerKey = String(partnerId || partner.toLowerCase());

  const [count, version] = await Promise.all([
    nextSeq(`count:${dayKey}:${partnerKey}`),
    nextSeq(`version:${dayKey}:${jobId}`),
  ]);

  return {
    fileName: `${partner}_${stamp}_${count}_v${version}.pdf`,
    count,
    version,
  };
};

// Raw upload with the file name as public_id. Raw resources need the .pdf
// extension inside the public_id, and must not also pass format: "pdf".
export const uploadPodPdf = (buffer, fileName) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: FOLDER,
        public_id: fileName,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    stream.end(buffer);
  });

// Older slips have no stored publicId, so read it off the URL:
// .../raw/upload/v123/pickitup/podslips/podslip_1730.pdf -> pickitup/podslips/podslip_1730.pdf
const publicIdFromUrl = (url = "") => {
  const match = url.match(/\/raw\/upload\/(?:v\d+\/)?(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
};

// Best effort: a failed delete is logged but never fails the PDF job.
export const deletePodPdf = async (podSlip) => {
  const publicId = podSlip?.publicId || publicIdFromUrl(podSlip?.pdfUrl);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "raw",
      invalidate: true,
    });
  } catch (err) {
    console.error(
      `[pdfWorker] Could not delete old PDF ${publicId}:`,
      err.message,
    );
  }
};
