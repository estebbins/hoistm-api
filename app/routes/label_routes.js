// Express docs: http://expressjs.com/en/api.html
const express = require('express')
// Passport docs: http://www.passportjs.org/docs/
const passport = require('passport')

const Label = require('../models/label')
const File = require('../models/file')
const User = require('../models/user')

// this is a collection of methods that help us detect situations when we need
// to throw a custom error
const customErrors = require('../../lib/custom_errors')

// we'll use this function to send 404 when non-existant document is requested
const handle404 = customErrors.handle404
// we'll use this function to send 401 when a user tries to modify a resource
// that's owned by someone else
const requireOwnership = customErrors.requireOwnership

// this is middleware that will remove blank fields from `req.body`, e.g.
// { label: { title: '', text: 'foo' } } -> { label: { text: 'foo' } }
const removeBlanks = require('../../lib/remove_blank_fields')
// passing this as a second argument to `router.<verb>` will make it
// so that a token MUST be passed for that route to be available
// it will also set `req.user`
const requireToken = passport.authenticate('bearer', { session: false })

// instantiate a router (mini app that only handles routes)
const router = express.Router()

// INDEX
// GET
router.get('/filelabels/:fileId', requireToken, (req, res, next) => {
    const fileId = req.params.fileId
    Label.find({fileRef: {$elemMatch: {_id: fileId}}})
        .populate('owner')
        .populate('fileRef')
		.then((labels) => {
			// `labels` will be an array of Mongoose documents
			// we want to convert each one to a POJO, so we use `.map` to
			// apply `.toObject` to each one
			return labels.map((label) => label.toObject())
		})
		// respond with status 200 and JSON of the labels
		.then((labels) => res.status(200).json({ labels: labels }))
		// if an error occurs, pass it to the handler
		.catch(next)
})

// INDEX
// GET /labels
router.get('/labels', requireToken, (req, res, next) => {
    Label.find()
        .populate('owner')
		.then((labels) => {
			// `labels` will be an array of Mongoose documents
			// we want to convert each one to a POJO, so we use `.map` to
			// apply `.toObject` to each one
			return labels.map((label) => label.toObject())
		})
		// respond with status 200 and JSON of the labels
		.then((labels) => res.status(200).json({ labels: labels }))
		// if an error occurs, pass it to the handler
		.catch(next)
})

// SHOW
// GET /labels/5a7db6c74d55bc51bdf39793
router.get('/labels/:id', requireToken, (req, res, next) => {
	// req.params.id will be set based on the `:id` in the route
    Label.findById(req.params.id)
        .populate('fileRef')
        .populate('owner')
		.then(handle404)
		// if `findById` is succesful, respond with 200 and "label" JSON
		.then((label) => res.status(200).json({ label: label.toObject() }))
		// if an error occurs, pass it to the handler
		.catch(next)
})

// CREATE
// POST /labels
router.post('/labels', requireToken, (req, res, next) => {
	// set owner of new label to be current user
	req.body.label.owner = req.user.id

	Label.create(req.body.label)
		// respond to succesful `create` with status 201 and JSON of new "label"
		.then((label) => {
			res.status(201).json({ label: label.toObject() })
		})
		// if an error occurs, pass it off to our error handler
		// the error handler needs the error message and the `res` object so that it
		// can send an error message back to the client
		.catch(next)
})

// UPDATE
// PATCH /labels/5a7db6c74d55bc51bdf39793/f3u459032u534u09t24u
router.patch('/labels/:labelId/:fileId', requireToken, removeBlanks, (req, res, next) => {
	// if the client attempts to change the `owner` property by including a new
	// owner, prevent that by deleting that key/value pair
	// delete req.body.label.owner

    const { labelId, fileId } = req.params
    console.log('params', req.params)

	Label.findById(labelId)
		.then(handle404)
		.then((label) => {
			// pass the `req` object and the Mongoose record to `requireOwnership`
			// it will throw an error if the current user isn't the owner
			requireOwnership(req, label)
            File.findById(fileId)
                .then(file => {
                    label.fileRef.push(file)
                    return label.save()
                })
                // .then(file => {
                //     res.status(201).json({ label: label.toObject() })
                //     // return label.updateOne(req.body.label)
                // })
                // if that succeeded, return 204 and no JSON
                .then(() => res.sendStatus(204))
                .catch(next)
			// pass the result of Mongoose's `.update` to the next `.then`
		})
		// if an error occurs, pass it to the handler
		.catch(next)
})

// UPDATE
// PATCH /labels/5a7db6c74d55bc51bdf39793
router.patch('/labels/:id', requireToken, removeBlanks, (req, res, next) => {
	// if the client attempts to change the `owner` property by including a new
	// owner, prevent that by deleting that key/value pair
	delete req.body.label.owner

	Label.findById(req.params.id)
		.then(handle404)
		.then((label) => {
			// pass the `req` object and the Mongoose record to `requireOwnership`
			// it will throw an error if the current user isn't the owner
			requireOwnership(req, label)

			// pass the result of Mongoose's `.update` to the next `.then`
			return label.updateOne(req.body.label)
		})
		// if that succeeded, return 204 and no JSON
		.then(() => res.sendStatus(204))
		// if an error occurs, pass it to the handler
		.catch(next)
})

// DESTROY
// DELETE /labels/5a7db6c74d55bc51bdf39793
router.delete('/labels/:id', requireToken, (req, res, next) => {
	Label.findById(req.params.id)
		.then(handle404)
		.then((label) => {
			// throw an error if current user doesn't own `label`
			requireOwnership(req, label)
			// delete the label ONLY IF the above didn't throw
			label.deleteOne()
		})
		// send back 204 and no content if the deletion succeeded
		.then(() => res.sendStatus(204))
		// if an error occurs, pass it to the handler
		.catch(next)
})

module.exports = router
