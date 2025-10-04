"use strict";
import pick from "lodash/pick.js";
const getInfoData = ({ fields, object }) => {
  return pick(object, fields);
};

export { getInfoData };
