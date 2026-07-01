import mongoose from "mongoose";

const podSlip = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    courierId: {
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
      default:1,
    },
    pickupTimestamp: {
      type: Date,
      required: true,
      immutable: true,
    },
    gpsLng: {
      type: Number,
      required: true,
      immutable: true,
    },
    gpsLat: {
      type: Number,
      required: true,
      immutable: true,
    },
  },
  {
    timestamps: true,
  },
);
export const PodSlip = mongoose.model("PodSlip", podSlip);
