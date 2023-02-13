const mongoose = require('mongoose')
const contributorSchema = require('./contributor')

const fileSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true
    }, 
    owner: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	},
    labels: {
        type: Array,
    },
    description: {
        type: String
    },
    contributors: [contributorSchema]
}, {
    timestamps: true
})

module.exports = mongoose.model('File', fileSchema)
