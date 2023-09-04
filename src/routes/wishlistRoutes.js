const express = require('express');
const { authenticateUser } = require('../middleware/authentication');
const {
  addAlbumToWishlist,
  removeAlbumFromWishlist,
  createWishlist,
  getAllWishlists,
  getSingleWishlist, // Import the createWishlist function
} = require('../controllers/wishlistController');

const router = express.Router();
router
  .route('/')
  .post(authenticateUser, createWishlist) // Create wishlist route
  .get(getAllWishlists);

router.patch(
  '/:wishlist_id/add_album/:album_id',
  authenticateUser,
  addAlbumToWishlist
);

router.patch(
  '/:wishlist_id/remove_album/:album_id',
  authenticateUser,
  removeAlbumFromWishlist
);

router.route('/:id').get(getSingleWishlist);

module.exports = router;
