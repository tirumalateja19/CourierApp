import mongoose from "mongoose";
const auditLog = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    actorRole: {
      type: String,
      enum: {
        values: ["admin", "partner"],
      },
      message: "{VALUE} is not a valid role",
      required: true,
      immutable: true,
    },
    action: {
      type: String,
      enum: {
        values: [
          "job created",
          "job assigned",
          "status updated",
          "pod generated",
          "job auto locked",
          "job unlocked",
          "items edited",
          "pdf regenerated",
          "job locked",
          "job dispatched",
        ],
        message: "{VALUE} is not a valid action",
      },
      required: true,
      immutable: true,
    },
    previousStatus: {
      type: String,
      immutable: true,
    },
    newStatus: {
      type: String,
      immutable: true,
    },
  },
  {
    timestamps: true,
  },
);
export const AuditLog = mongoose.model("AuditLog", auditLog);
