import mongoose from "mongoose";

const podSlip = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    generatedById: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    pdfUrl: {
      type: String,
      required: true,
    },
    pdfHash: {
      type: String,
      required: true,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  },
);
export const PodSlip = mongoose.model("PodSlip", podSlip);
