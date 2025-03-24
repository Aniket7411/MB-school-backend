const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  town :{
    type: String,
  },
  address : {
    type: String,
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  hasWonLottery: {
    type: Boolean,
    default: false,
  },
  lastWinDate: {
    type: Date,
  },
  scheduledLotteryTime: {
    type: Date,
    // type: String,
  },
  mobileNumber: {
    type: String,
  },
  upiId: {
    type: String,
  },
  qrCodeImage: {
    type: String,
  },
  lotteryName: {
    type: String,
  },

  registeredDate:{
    type: Date,
    default:Date.now,
  },
  tokenID: {
    type: Number,
  },
  
});

module.exports = mongoose.model('User', userSchema);
