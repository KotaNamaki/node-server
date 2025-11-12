const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/orderController');
const {authReq} = require('../middleware/authMiddleWare');

router.post('/cart', authReq, purchaseController.addToCart);
router.post('/order', authReq, purchaseController.addOrder);
router.post('/payment', authReq, purchaseController.addPayment);

module.exports = router;

