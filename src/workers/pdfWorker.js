// workers/pdfWorker.js
import { Worker } from "bullmq";
import connection from "../config/redis.js";

const pdfWorker = new Worker(
  "pdf-generation",
  async (job) => {
    console.log(`Processing job: ${job.name}, data:`, job.data);

    if (job.name === "generate-invoice") {
      console.log(`Generating invoice for job ${job.data.jobId}...`);
      // real PDF logic goes here later
    }

    if (job.name === "generate-pod-slip") {
      console.log(`Generating pod slip for job ${job.data.jobId}...`);
      // real PDF logic goes here later
    }
  },
  { connection },
);

pdfWorker.on("completed", (job) => {
  console.log(`Job ${job.id} (${job.name}) completed`);
});

pdfWorker.on("failed", (job, err) => {
  console.error(`Job ${job.id} (${job.name}) failed:`, err.message);
});

export default pdfWorker;
