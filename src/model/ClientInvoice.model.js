import mongoose from "mongoose";

const clientInvoice = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    generatedById: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    generatedByRole: {
      type: String,
      enum: {
        values: ["admin", "partner"],
      },
      message: "{VALUE} is not a valid role",
    },
    price: {
      type: String,
      required: true,
    },
    pdfUrl: {
      type: String,
      required: true,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  },
);
const ClientInvoice = mongoose.model("ClientInvoice", clientInvoice);
export default ClientInvoice;
