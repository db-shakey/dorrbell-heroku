var express = require('express')
  , router = express.Router()

//
// router.use('/contacts', require('./contacts'));
router.use('/orders', require('./orders'));
router.use('/products', require('./products'))
router.use('/authenticate', require('./authenticate'));
module.exports = router
