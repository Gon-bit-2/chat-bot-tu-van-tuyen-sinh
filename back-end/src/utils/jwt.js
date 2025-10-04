const createTokenPair = async (payload, publicKey, privateKey) => {
  const accessToken = await jwt.sign(payload, publicKey, {
    expiresIn: "7d",
  });
  const refreshToken = await jwt.sign(payload, privateKey, {
    expiresIn: "7d",
  });
  //
  jwt.verify(accessToken, publicKey, (err, decoded) => {
    if (err) {
      console.error(`error verify`, err);
    } else {
      console.log(`decoded verify`, decoded);
    }
  });
  return {
    accessToken,
    refreshToken,
  };
};
export { createTokenPair };
