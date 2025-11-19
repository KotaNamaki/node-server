const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const {authReq} = require("../middleware/authMiddleWare")
const rateLimit = require("express-rate-limit");

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message:{
        message: 'Terlalu banyak request register dari IP ini, coba lagi nanti'
    }
});


const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 5, // Maksimal 5 kali salah password per 15 menit
    message: 'Terlalu banyak percobaan login. Akun dikunci sementara selama 15 menit.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
});


router.post('/login', authLimiter,userController.userLogin);
router.post('/register', registerLimiter, userController.userRegister);

router.post('/logout', authReq, userController.userLogout);

module.exports = router;
