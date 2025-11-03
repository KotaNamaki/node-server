const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');


router.get('/search/:id', productController.getProductById);
router.post('/', productController.addProduct);
router.get('/search', productController.getProductAll);

module.exports = router;
