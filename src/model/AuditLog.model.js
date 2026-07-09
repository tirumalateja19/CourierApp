import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      immutable: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      immutable: true,
    },
    actorRole: {
      type: String,
      enum: {
        values: ["admin", "partner", "system"],
        message: "{VALUE} is not a valid role",
      },
      required: true,
      immutable: true,
    },
    action: {
      type: String,
      enum: {
        values: [
          "jobCreated",
          "jobAssigned",
          "statusUpdated",
          "pdfGenerated",
          "pdfRegenerated",
          "jobAutoLocked",
          "jobLocked",
          "jobUnlocked",
          "itemsEdited",
          "jobDispatched",
          "partnerDeactivated",
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
  { timestamps: true },
);

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
