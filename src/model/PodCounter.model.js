import mongoose from "mongoose";

// One small document per counter. The key carries the day, so a new day simply
// starts from 1. Old counters delete themselves a few days after their last use.
const podCounter = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

podCounter.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 3 });

export const PodCounter = mongoose.model("PodCounter", podCounter);
