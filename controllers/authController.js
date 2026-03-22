const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TrackRequest = require('../models/TrackRequest'); 

// 1. SIGNUP
exports.signup = async (req, res) => {
  try {
    // fullName ko destructure karein
    const { email, password, fullName } = req.body; 
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Yahan fullName add karna zaroori hai
    const newUser = await User.create({ 
      email, 
      password: hashedPassword, 
      fullName 
    });
    
    res.status(201).json({ message: "User created successfully!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 2. LOGIN (Bilkul sahi hai, bas ek bar check kar lo ki fullName user object mein ja raha hai)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    
    res.status(200).json({ 
      token, 
      user: {
        _id: user._id,
        email: user.email,
        fullName: user.fullName || "", // Agar null ho toh empty string jaye
        mobile: user.mobile || "",
        address: user.address || "",
        location: user.location
      } 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 3. UPDATE PROFILE
exports.updateProfile = async (req, res) => {
  try {
    const { email, fullName, mobile, address, latitude, longitude } = req.body;

    const updatedUser = await User.findOneAndUpdate(
      { email },
      { 
        $set: { 
          fullName, 
          mobile, 
          address, 
          location: { latitude, longitude } 
        } 
      },
      { new: true }
    );

    res.status(200).json({ message: "Profile updated!", user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};

// 4. GET HISTORY (Updated logic for ObjectIds)
exports.getHistory = async (req, res) => {
  try {
    const { userId } = req.params; 

    const history = await TrackRequest.find({
      // Hum woh requests dhoond rahe hain jahan user ya toh sender hai ya receiver
      $or: [{ sender: userId }, { receiver: userId }]
    })
    .populate('sender', 'fullName mobile') // Frontend par naam dikhane ke liye populate zaroori hai
    .populate('receiver', 'fullName mobile')
    .sort({ createdAt: -1 }); 

    res.status(200).json(history);
  } catch (err) {
    res.status(500).json({ message: "History fetch failed", error: err.message });
  }
};

// 5. SAVE TRACK REQUEST (Crucial Fix: Mobile to ID conversion)
exports.saveTrackRequest = async (req, res) => {
  try {
    const { senderId, targetMobile } = req.body;

    // 🚩 Problem: Schema mein 'receiver' ObjectId mangta hai, par frontend se 'mobile' aa raha hai
    // Solution: Pehle receiver ko database mein dhoondo
    const receiverUser = await User.findOne({ mobile: targetMobile });
    
    if (!receiverUser) {
      return res.status(404).json({ message: "Target user not found with this mobile number" });
    }

    // Check karo ki kahin khud ko hi track toh nahi kar rahe
    if (senderId === receiverUser._id.toString()) {
      return res.status(400).json({ message: "You cannot track yourself" });
    }

    const newRequest = new TrackRequest({
      sender: senderId,       // Schema field name 'sender' hai, 'senderId' nahi
      receiver: receiverUser._id, // Schema field name 'receiver' hai
      status: 'pending'
    });

    await newRequest.save();
    res.status(201).json({ message: "Request saved to history", data: newRequest });
  } catch (err) {
    res.status(500).json({ message: "Request save nahi ho payi", error: err.message });
  }
};

// controllers/authController.js
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('fullName mobile _id');
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ message: "Users load nahi ho paye" });
    }
};

// 6. DELETE HISTORY RECORD
exports.deleteHistory = async (req, res) => {
  try {
    const { id } = req.params; // Frontend se URL mein ID aayegi

    const deletedRecord = await TrackRequest.findByIdAndDelete(id);

    if (!deletedRecord) {
      return res.status(404).json({ message: "Record nahi mila!" });
    }

    res.status(200).json({ message: "History record deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete karne mein error aaya", error: err.message });
  }
};