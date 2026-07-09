import validator from "validator";

const validateNewPassword = (req) => {
  const { password } = req.body;
  if (!password) {
    throw new Error("Password is required");
  }
  if (!validator.isStrongPassword(password)) {
    throw new Error("Enter a strong password");
  }
};
export default validateNewPassword;
