import mongoose from "mongoose";
const shipment = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    networkName: {
      type: String,
      required: true,
    },
    trackingId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);
export const Shipment = mongoose.model("Shipment", shipment);
