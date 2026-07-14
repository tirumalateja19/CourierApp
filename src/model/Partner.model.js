import mongoose from "mongoose";
import validator from "validator";
const partnerSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      trim: true,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      trim: true,
      required: true,
      validate(value) {
        if (!validator.isStrongPassword(value)) {
          throw new Error("Weak Password");
        }
      },
    },
    contactNumber: {
      type: String,
      trim: true,
      required: true,
      unique: true,
      maxLength: 10,
    },
    availableStatus: {
      type: Boolean,
      default: false,
    },
    isDeactivated: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);
const Partner = mongoose.model("Partner", partnerSchema);
export default Partner;
