import mongoose from "mongoose";
const jobItem = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    fragile: {
      type: Boolean,
      default: false,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);
export const JobItem = mongoose.model("JobItem", jobItem);
