const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  mobile: { type: String, default: "" }, // Not required for signup
  address: { type: String, default: "" },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null }
  }
}, { timestamps: true });


module.exports = mongoose.model('User', userSchema);