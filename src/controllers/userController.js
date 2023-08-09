const User = require('../models/User');
const { StatusCodes } = require('http-status-codes');
const CustomError = require('../errors');
const argon2 = require('argon2');
const {
  createTokenUser,
  attachCookiesToResponse,
  checkPermissions,
} = require('../utils');

const getAllUsers = async (req, res) => {
  // Function to get all users
  // Find all users with the role 'user' in the database and exclude the 'password' field
  const users = await User.find({ role: 'user' }).select('-password');
  res.status(StatusCodes.OK).json({ users }); // Send a JSON response with the status code 200 OK and the users
};

const getSingleUser = async (req, res) => {
  // Function to get a single user by ID
  // Find the user in the database based on the provided user ID and exclude the 'password' field
  const user = await User.findOne({ _id: req.params.id }).select('-password');
  if (!user) {
    // Throw a NotFoundError if the user is not found
    throw new CustomError.NotFoundError(`No user with id: ${req.params.id}`);
  }
  checkPermissions(req.user, user._id); // Check if the user has permission to access the user's information
  res.status(StatusCodes.OK).json({ user }); // Send a JSON response with the status code 200 OK and the user
};

const showCurrentUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.user.userId }).select('-password');
    if (!user) {
      throw new CustomError.NotFoundError('User not found');
    }
    res.status(StatusCodes.OK).json({ user });
  } catch (error) {
    next(error);
  }
};

// update user with user.save()
const updateUser = async (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) {
    // Check if email and name are provided
    throw new CustomError.BadRequestError('Please provide all values');
  }
  const user = await User.findOne({ _id: req.user.userId }); // Find the user in the database based on the current user's ID
  // Update the user's email and name
  user.email = email;
  user.name = name;
  await user.save(); // Save the updated user to the database
  const tokenUser = createTokenUser(user); // Create a token user and attach the user's cookies to the response
  attachCookiesToResponse({ res, user: tokenUser });
  // Send a JSON response with the status code 200 OK and the updated user
  res.status(StatusCodes.OK).json({ user: tokenUser });
};

const updateUserPassword = async (req, res) => {
  // Function to update the current user's password
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    // Check if oldPassword and newPassword are provided
    throw new CustomError.BadRequestError('Please provide both values');
  }
  const user = await User.findOne({ _id: req.user.userId }); // Find the user in the database based on the current user's ID
  // Compare the old password provided with the user's current password
  const isPasswordCorrect = await user.comparePassword(oldPassword);
  if (!isPasswordCorrect) {
    // Throw an UnauthenticatedError if the old password is incorrect
    throw new CustomError.UnauthenticatedError('Invalid Credentials');
  }

  const hashedNewPassword = await argon2.hash(newPassword);
  user.password = hashedNewPassword; // Update the user's password

  await user.save(); // Save the updated user to the database
  // Send a JSON response with the status code 200 OK and a success message
  res.status(StatusCodes.OK).json({ msg: 'Success! Password Updated.' });
};

const deleteSingleUser = async (req, res) => {
  const userId = req.params.id;
  // Find the user by ID and delete
  await User.findByIdAndDelete(userId);
  res.status(StatusCodes.OK).json({ message: 'User deleted successfully' });
};

module.exports = {
  getAllUsers,
  getSingleUser,
  showCurrentUser,
  updateUser,
  updateUserPassword,
  deleteSingleUser,
};
