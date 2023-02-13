// Express docs: http://expressjs.com/en/api.html
const express = require('express')
// Passport docs: http://www.passportjs.org/docs/
const passport = require('passport')

const multer = require('multer')
const storage = multer.memoryStorage()
// const upload = multer({ storage: storage })
// const s3Upload = require('../../lib/s3_upload')

// pull in Mongoose model for files
const File = require('../models/file')

// this is a collection of methods that help us detect situations when we need
// to throw a custom error
const customErrors = require('../../lib/custom_errors')

// we'll use this function to send 404 when non-existant document is requested
const handle404 = customErrors.handle404
// we'll use this function to send 401 when a user tries to modify a resource
// that's owned by someone else
const requireOwnership = customErrors.requireOwnership

// this is middleware that will remove blank fields from `req.body`, e.g.
// { contributors: { title: '', text: 'foo' } } -> { contributors: { text: 'foo' } }
const removeBlanks = require('../../lib/remove_blank_fields')
// passing this as a second argument to `router.<verb>` will make it
// so that a token MUST be passed for that route to be available
// it will also set `req.user`
const requireToken = passport.authenticate('bearer', { session: false })

// instantiate a router (mini app that only handles routes)
const router = express.Router()

// POST -> create a contributor(and give that contributor to a file)
// POST /contributors/:fileId
router.post('/contributors/:fileId', requireToken, removeBlanks, (req, res, next) => {

    const contributor = req.body.contributor

    const fileId = req.params.fileId
    File.findById(fileId)
        // first step is to use our custom 404 middleware
        .then(handle404)
        .then(file => {
            requireOwnership(req, file)
            file.contributors.push(contributor)
            // save the file
            return file.save()
        })
        // send info after updating the file
        .then(file => res.status(201).json({ file: file }))
        // pass errors along to our error handler
        .catch(next)
})

// PATCH -> update a contributor
// PATCH /contributors/:fileId/:contributorId
router.patch('/contributors/:fileId/:contributorId', requireToken, removeBlanks, (req, res, next) => {
    // get and save the id's to variables
    const fileId = req.params.fileId
    const contributorId = req.params.contributorId

    // find our file
    File.findById(fileId)
        .then(handle404)
        .then(file => {
            const theContributor = file.contributors.id(contributorId)
            // make sure the user is the file's owner
            requireOwnership(req, file)
            // update accordingly
            theContributor.set(req.body.contributor)

            return file.save()
        })
        // send a status
        .then(() => res.sendStatus(204))
        .catch(next)
})

// DELETE -> destroy a contributor
// DELETE /contributors/:fileId/:contributorId
router.delete('/contributors/:fileId/:contributorId', requireToken, (req, res, next) => {
    const fileId = req.params.fileId
    const contributorId = req.params.contributorId

    // find the file
    File.findById(fileId)
        .then(handle404)
        // grab the specific contributor using it's id
        .then(file => {
            // isolate the contributor
            const theContributor = file.contributors.id(contributorId)
            // make sure the user is the owner of the file
            requireOwnership(req, file)
            // call remove on our contributor subdoc
            theContributor.remove()
            // return the saved file
            return file.save()
        })
        // send a response
        .then(() => res.sendStatus(204))
        // pass errors to our error handler (using next)
        .catch(next)
})

// export our router
module.exports = router