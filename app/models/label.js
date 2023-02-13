const mongoose = require('mongoose')
const User = require('./user')
const File = require('./file')


const labelSchema = new mongoose.Schema({

    owner: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'

	},
    fileRef: [{
        type: mongoose.Schema.Types.ObjectId,
        ref:'File'
    }],
    name: {type: String, required: true},
    color: {type: String, required: true},
},
{
  timestamps: true
}
)

module.exports = mongoose.model('Label', labelSchema)
