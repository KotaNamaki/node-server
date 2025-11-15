const express = require('express');
const userController = require('../controllers/userController');
const router = express.Router();
const {authReq, adminReq} = require('../middleware/authMiddleware');

router.use(authReq, adminReq);

// Pemetaan URL ke ke fungsi router
router.get('/:id', userController.getUserById);
router.get('/', userController.getUser);
router.patch('/update/:id', userController.updateUser);

module.exports = router;