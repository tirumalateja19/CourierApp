import AuditLog from "../model/AuditLog.model.js";

const createAuditLog = async ({
  jobId,
  actorId,
  actorRole,
  action,
  previousStatus,
  newStatus,
}) => {
  try {
    await AuditLog.create({
      jobId,
      actorId,
      actorRole,
      action,
      previousStatus,
      newStatus,
    });
  } catch (error) {
    console.error("Audit log failed:", error.message);
    // intentionally not re-thrown — audit logging must never block the main action
  }
};
export default createAuditLog;
