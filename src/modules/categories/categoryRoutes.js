const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../shared/middleware/auth');
const {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  createSubCategory,
  getSubCategories,
  updateSubCategory,
  deleteSubCategory,
} = require('../categories/categoryController');

router.get('/', getCategories);
router.get('/:id', getCategory);
router.get('/:id/subcategories', getSubCategories);
router.post('/', protect, authorize('admin'), createCategory);
router.put('/:id', protect, authorize('admin'), updateCategory);
router.delete('/:id', protect, authorize('admin'), deleteCategory);
router.post('/subcategories', protect, authorize('admin'), createSubCategory);
router.put('/subcategories/:id', protect, authorize('admin'), updateSubCategory);
router.delete('/subcategories/:id', protect, authorize('admin'), deleteSubCategory);

module.exports = router;
