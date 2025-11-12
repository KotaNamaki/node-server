const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');


router.get('/search/:id', productController.getProductById);
router.get('/search', productController.getProductAll);
router.post('/', productController.addProduct);
router.patch('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
