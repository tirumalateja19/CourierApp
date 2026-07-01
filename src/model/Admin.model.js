import mongoose from "mongoose";
const adminSchema = new mongoose.Schema(
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
  },
  { timestamps: true },
);
const Admin = mongoose.model("Admin", adminSchema);
export default Admin;
