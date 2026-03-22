const TrackRequest = require('../models/TrackRequest');
const User = require('../models/User');

// 1. UPDATE USER LIVE LOCATION (Target user apni location yahan se bhejega)
exports.updateUserLocation = async (req, res) => {
  try {
    const { userId, latitude, longitude } = req.body;

    if (!userId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: "Data incomplete hai bhai!" });
    }

    // User ki profile mein location update karo
    await User.findByIdAndUpdate(userId, {
      location: {
        latitude: latitude,
        longitude: longitude,
        lastUpdated: new Date()
      }
    });

    res.status(200).json({ message: "Location updated on server!" });
  } catch (err) {
    res.status(500).json({ message: "Update fail!", error: err.message });
  }
};

// 1. Send Tracking Request (UPDATED FOR RE-APPROVAL)
exports.sendRequest = async (req, res) => {
  try {
    const { senderId, targetMobile } = req.body;

    if (!senderId || !targetMobile) {
      return res.status(400).json({ message: "Bhai, senderId ya mobile number missing hai!" });
    }

    // 2. Receiver dhoondo
    const receiver = await User.findOne({ mobile: targetMobile.trim() });
    if (!receiver) {
      return res.status(404).json({ message: "Ye mobile number registered nahi hai!" });
    }

    // 3. Khud ko track karne se roko
    if (receiver._id.toString() === senderId.toString()) {
      return res.status(400).json({ message: "Bhai, khud ko track karke kahan jaoge?" });
    }

    // ✅ 4. UPDATED: Existing request ko 'pending' par reset karein
    // Isse purana 'accepted' status khatam ho jayega aur map lock ho jayega
    const existing = await TrackRequest.findOne({ 
      sender: senderId, 
      receiver: receiver._id 
    });

    if (existing) {
      existing.status = 'pending'; // Wapas approval chahiye
      existing.updatedAt = Date.now(); // Timestamp update karein
      await existing.save();
      
      console.log("STATUS RESET: Request set to pending again ->", existing._id);
      return res.status(200).json({ 
        message: "Purani link reset! Request sent again for approval.", 
        status: 'pending' 
      });
    }

    // 5. Create New Request (Agar pehle kabhi link nahi hua toh)
    const newRequest = await TrackRequest.create({
      sender: senderId,
      receiver: receiver._id,
      status: 'pending'
    });

    console.log("SUCCESS: New Request Created ->", newRequest._id);
    res.status(200).json({ 
      message: "Request sent successfully!", 
      requestId: newRequest._id,
      status: 'pending' 
    });

  } catch (err) {
    console.error("CRITICAL ERROR:", err);
    res.status(500).json({ message: "Server Error: " + err.message });
  }
};

// 2. Get Pending Requests (For the receiver)
exports.getIncomingRequests = async (req, res) => {
  try {
    const { userId } = req.params;
    const requests = await TrackRequest.find({ receiver: userId, status: 'pending' })
      .populate('sender', 'fullName mobile'); // Sender ki info bhi chahiye
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 3. Respond to Request (Accept/Reject)
exports.respondToRequest = async (req, res) => {
  try {
    const { requestId, status } = req.body; // status: 'accepted' or 'rejected'
    
    const request = await TrackRequest.findByIdAndUpdate(requestId, { status }, { new: true });
    
    if (status === 'accepted') {
      res.status(200).json({ message: "Now sharing location!", request });
    } else {
      res.status(200).json({ message: "Request rejected!" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// controllers/trackController.js ke niche ye add karein:

exports.getFriendLocation = async (req, res) => {
  try {
    const { senderId, receiverId } = req.query;
    
    // Check permission
    const permission = await TrackRequest.findOne({ 
      sender: senderId, 
      receiver: receiverId, 
      status: 'accepted' 
    });
    
    if (!permission) return res.status(403).json({ message: "Permission nahi hai bhai!" });

    // Agar permission hai toh location bhejo
    const friend = await User.findById(receiverId).select('location fullName mobile');
    res.status(200).json(friend);
  } catch (err) {
    res.status(500).json({ message: "Location fetch karne mein error", error: err.message });
  }
};

// 5. Polling function status check (FIXED & DEBUGGED)
exports.getTrackingStatus = async (req, res) => {
  try {
    const { senderId, mobile } = req.params;

    // Mobile se receiver dhundo
    const receiver = await User.findOne({ mobile: mobile.trim() });
    if (!receiver) return res.status(404).json({ message: "User not found" });

    // Latest request status check karo
    const request = await TrackRequest.findOne({
      sender: senderId,
      receiver: receiver._id
    }).sort({ createdAt: -1 });

    if (!request) return res.json({ status: 'none' });

    let locationData = null;
    
    // ✅ Logic: Agar accepted hai par location nahi hai, toh debug log dikhao
    if (request.status === 'accepted') {
      if (receiver.location && receiver.location.latitude) {
        locationData = {
          lat: receiver.location.latitude || receiver.location.lat,
          lng: receiver.location.longitude || receiver.location.lng
        };
      } else {
        console.log(`⚠️ User ${mobile} accepted request, but their location is NOT set in profile!`);
      }
    }

    res.status(200).json({
      status: request.status,
      location: locationData // Frontend ko null milega agar location set nahi hai
    });

  } catch (err) {
    console.error("Status Check Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};