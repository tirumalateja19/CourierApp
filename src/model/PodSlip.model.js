import mongoose from "mongoose";

const podSlip = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
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
    sourceHash: {
      type: String,
      required: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    count: {
      type: Number,
    },
    fileName: {
      type: String,
    },
    publicId: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);
export const PodSlip = mongoose.model("PodSlip", podSlip);
