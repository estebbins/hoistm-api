const mongoose = require('mongoose')

const contributorSchema = new mongoose.Schema({
  userRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }, 
  permissionLevel: {
    type: String,
    enum: ['read only', 'read and write'],
    default: 'read only',
    required: true
  }
}, {
  timestamps: true
})

module.exports = contributorSchema

