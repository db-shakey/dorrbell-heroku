var express = require('express')
  , router = express.Router()

//
// router.use('/contacts', require('./contacts'));
router.use('/authenticate', require('./authenticate'));
router.use(require('../middlewares/salesforce').authenticate)
router.use('/orders', require('./orders'));
router.use('/products', require('./products'))

module.exports = router
