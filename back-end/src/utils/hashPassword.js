import bcrypt from "bcrypt";
const saltRounds = 10;
const hashPassword = async (plaintext) => {
  return await bcrypt.hash(plaintext, saltRounds);
};
const comparePassword = async (plaintext, hashPassword) => {
  return await bcrypt.compare(plaintext, hashPassword);
};

export { hashPassword, comparePassword };
