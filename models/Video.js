const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
  igUrl: { type: String, required: true, unique: true }, // no duplicates
  status: {
    type: String,
    enum: ["pending", "posted", "failed"],
    default: "pending",
  },
  youtubeUrl: { type: String, default: null },
  error: { type: String, default: null },
  addedAt: { type: Date, default: Date.now },
  postedAt: { type: Date, default: null },
});

module.exports = mongoose.model("Video", videoSchema);
