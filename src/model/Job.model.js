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
    clientCity: {
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
          "Created",
          "Assigned",
          "PickedUp",
          "AtOffice",
          "Dispatched",
          "Cancelled",
        ],
        message: "{VALUE} is incorrect status",
      },
      default: "Created",
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
    networkName: {
      type: String,
      default: null,
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
    packages: [
      {
        weight: Number,
        length: Number,
        breadth: Number,
        height: Number,
      },
    ],
    numberOfPackages: {
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
    receiverCity: {
      type: String,
      trim: true,
    },
    receiverZipCode: {
      type: String,
      trim: true,
    },
    receiverCountry: {
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
    dispatchedAt: {
      type: String,
      trim: true,
    },
    podSlipGenerated: {
      type: Boolean,
      default: false,
    },
    podGeneratedBy: {
      type: String,
    },
    locked: {
      type: Boolean,
      default: false,
      required: true,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    lockedReason: {
      type: String,
      enum: ["review", "dispatched", "dispute", "mismatch"],
      default: null,
    },
    unlockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    unlockedByAdminName: {
      type: String,
      default: null,
    },
    cancelReason: {
      type: String,
      trim: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const Job = mongoose.model("Job", jobs);
