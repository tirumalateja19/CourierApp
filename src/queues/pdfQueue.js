import { Queue } from "bullmq";
import connection from "../config/redis.js";

const pdfQueue = new Queue("pdf-generation", { connection });

export default pdfQueue;
