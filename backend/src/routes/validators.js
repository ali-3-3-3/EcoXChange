const express = require('express');
const router = express.Router();

// Placeholder routes - will be implemented in Phase 2
router.get('/', (req, res) => {
  res.status(501).json({ message: 'Validator routes will be implemented in Phase 2' });
});

router.post('/validate', (req, res) => {
  res.status(501).json({ message: 'Validator routes will be implemented in Phase 2' });
});

router.get('/pending', (req, res) => {
  res.status(501).json({ message: 'Validator routes will be implemented in Phase 2' });
});

module.exports = router;
