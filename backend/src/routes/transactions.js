const express = require('express');
const router = express.Router();

// Placeholder routes - will be implemented in Phase 2
router.get('/', (req, res) => {
  res.status(501).json({ message: 'Transaction routes will be implemented in Phase 2' });
});

router.post('/buy', (req, res) => {
  res.status(501).json({ message: 'Transaction routes will be implemented in Phase 2' });
});

router.post('/sell', (req, res) => {
  res.status(501).json({ message: 'Transaction routes will be implemented in Phase 2' });
});

router.get('/:id', (req, res) => {
  res.status(501).json({ message: 'Transaction routes will be implemented in Phase 2' });
});

module.exports = router;
