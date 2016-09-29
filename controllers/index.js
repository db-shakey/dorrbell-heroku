var express = require('express')
  , router = express.Router()

router.use('/products', require('./products'))
router.use('/contacts', require('./contacts'));
router.use('/orders', require('./orders'));
module.exports = router
