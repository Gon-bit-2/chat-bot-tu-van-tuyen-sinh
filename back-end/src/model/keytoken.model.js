"use strict";

import { model, Schema } from "mongoose";
const DOCUMENT_NAME = "Key";
const COLLECTION_NAME = "Keys";

const keyTokenSchema = new Schema(
  {
    userId: {
      type: Schema.ObjectId,
      required: true,
      ref: "User",
    },
    publicKey: {
      type: String,
      required: true,
    },
    privateKey: { type: String, required: true },
    refreshTokensUsed: {
      type: [String],
      default: [],
    },
    refreshToken: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

const keyToken = model(DOCUMENT_NAME, keyTokenSchema);
export default keyToken;
