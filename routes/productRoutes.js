const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const {authReq, adminReq} = require('../middleware/authMiddleWare');

router.get('/search/:id', productController.getProductById);
router.get('/search', productController.getProductAll);


router.post('/', authReq, adminReq, productController.addProduct);
router.patch('/:id', authReq, adminReq, productController.updateProduct);
router.delete('/:id', authReq, adminReq, productController.deleteProduct);

module.exports = router;
