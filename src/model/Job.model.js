import mongoose from "mongoose";
const jobs = new mongoose.Schema(
  {
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    clientNumber: {
      type: String,
      required: true,
      trim: true,
      maxLength: 10,
    },
    clientAddress: {
      type: String,
      required: true,
      trim: true,
    },
    scheduledTime: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: [
          "created",
          "assigned",
          "en_route",
          "picked_up",
          "at_office",
          "dispatched",
        ],
        message: "{VALUE} is incorrect status",
      },
      required: true,
      deafult: "created",
      trim: true,
    },
    assignedToId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    assignedToRole: {
      type: String,
    },
    assignedTo: {
      type: String,
    },
    packingStatus: {
      type: String,
      enum: {
        values: ["packed_at_source", "packed_at_office"],
      },
      message: "{VALUE} is not a valid status",
    },
    approxWeight: {
      type: String,
      trim: true,
      required: true,
    },
    weight: {
      type: String,
      trim: true,
    },
    dimensions: {
      type: String,
      trim: true,
    },
    receiverName: {
      type: String,
      trim: true,
    },
    receiverAddress: {
      type: String,
      trim: true,
    },
    receiverNumber: {
      type: String,
      trim: true,
      maxLength: 10,
    },
    price: {
      type: String,
      trim: true,
      maxLength: 6,
    },
    invoiceStatus: {
      type: String,
      enum: {
        values: ["generated_at_pickup", "pending_office_completion"],
      },
      message: "{VALUE} is not a valid status",
    },
    locked: {
      type: Boolean,
      default: false,
      required: true,
    },
    lockedAt: {
      type: Date,
    },
    lockedReason: {
      type: String,
    },
    unlockedBy: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true,
  },
);

export const Job = mongoose.model("Job", jobs);
