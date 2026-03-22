const express = require('express');
const router = express.Router();
// 🚩 Fix: Pura object import karo taaki niche use kar sako
const authController = require('../controllers/authController');
const trackController = require('../controllers/trackController');

// --- Auth Routes ---
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/update-profile', authController.updateProfile);
router.get('/all-users', authController.getAllUsers);

// --- History Routes (Jo aapne abhi controller mein add kiye) ---
router.get('/history/:userId', authController.getHistory);
router.post('/save-request', authController.saveTrackRequest);
// History delete karne ke liye route
router.delete('/delete-history/:id', authController.deleteHistory);

// --- Tracking Routes ---
router.post('/send-request', trackController.sendRequest);
router.get('/incoming/:userId', trackController.getIncomingRequests);
router.post('/respond', trackController.respondToRequest);
router.get('/friend-location', trackController.getFriendLocation);
router.get('/status/:senderId/:mobile', trackController.getTrackingStatus);
router.post('/update-location', trackController.updateUserLocation);

module.exports = router;