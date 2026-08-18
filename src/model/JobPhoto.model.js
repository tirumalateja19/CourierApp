import mongoose from "mongoose";

const jobPhoto = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    label: {
      type: String,
      enum: {
        values: [
          "id_proof",
          "waybill",
          "invoice",
          "packed_box",
          "item_evidence",
          "payment_reciept",
        ],
        message: "{VALUE} is not a valid label",
      },
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);
export const JobPhoto = mongoose.model("JobPhoto", jobPhoto);
