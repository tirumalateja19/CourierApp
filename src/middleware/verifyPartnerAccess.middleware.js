import { Job } from "../model/Job.model.js";

const verifyPartnerAccess = async (req, res, next) => {
  try {
    const id = req.params.id;

    const jobData = await Job.findById(id);
    if (!jobData) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (req.user.role === "admin") {
      req.job = jobData;
      return next();
    }

    if (jobData.assignedToId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "This job is not assigned to you" });
    }

    if (jobData.locked === true) {
      return res.status(403).json({ message: "Cannot edit, job is locked" });
    }

    req.job = jobData;
    next();
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export default verifyPartnerAccess;
