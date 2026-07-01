import mongoose from "mongoose";
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
      maxLength: 10,
    },
    avaliableStatus: {
      type: Boolean,
    },
  },
  { timestamps: true },
);
const Partner = mongoose.model("Partner", partnerSchema);
export default Partner;
