// Express docs: http://expressjs.com/en/api.html
const express = require('express')
// Passport docs: http://www.passportjs.org/docs/
const passport = require('passport')

const multer = require('multer')
const multerS3 = require('multer-s3')
// const storage = multer.memoryStorage()
// const aws = require('aws-sdk')
const aws = require('@aws-sdk/client-s3')
const { DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { GetObjectCommand } = require('@aws-sdk/client-s3')

// const upload = multer({ storage: storage })
// aws.config.update({ accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, region: process.env.AWS_REGION, })

const s3 = new aws.S3Client({ 
    accessKeyId: process.env.AWS_ACCESS_KEY_ID, 
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, 
    region: process.env.AWS_REGION
})
const upload = multer({
    storage: multerS3({
        s3: s3,
		acl: 'public-read',
        bucket: 'hoistm-cloud-system',
        key: function (req, file, cb) {
            console.log('file', file)
            cb(null, file.originalname + '_' + Date.now())
        }
    })
})
const s3Upload = require('../../lib/s3_upload')

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
// { file: { title: '', text: 'foo' } } -> { file: { text: 'foo' } }
const removeBlanks = require('../../lib/remove_blank_fields')

// passing this as a second argument to `router.<verb>` will make it
// so that a token MUST be passed for that route to be available
// it will also set `req.user`
const requireToken = passport.authenticate('bearer', { session: false })

// instantiate a router (mini app that only handles routes)
const router = express.Router()

// AWS Configuration

// INDEX
// GET /files
router.get('/files', requireToken, (req, res, next) => {
	File.find()
		.populate('contributors.userRef')
        .populate('owner')
        .then(handle404)
		.then((files) => {
			// `files` will be an array of Mongoose documents
			// we want to convert each one to a POJO, so we use `.map` to
			// apply `.toObject` to each one
			return files.map((file) => file.toObject())
		})
		// respond with status 200 and JSON of the files
		.then((files) => res.status(200).json({ files: files }))
		// if an error occurs, pass it to the handler
		.catch(next)
})

// SHOW
// GET /files/5a7db6c74d55bc51bdf39793
router.get('/files/:id', requireToken, (req, res, next) => {
	// req.params.id will be set based on the `:id` in the route
	File.findById(req.params.id)
        .populate('contributors.userRef')
        .populate('owner')
		.then(handle404)
		// if `findById` is succesful, respond with 200 and "file" JSON
		.then((file) => res.status(200).json({ file: file.toObject() }))
		// if an error occurs, pass it to the handler
		.catch(next)
})

router.post('/files', upload.single('file'), requireToken, (req, res, next) => {
    // upload.single() uploads the file to AWS and returns a file object (req.file)
    // console.log('body', req.body)
    console.log('file', req.file)   
    req.body.url = req.file.location
    // console.log('body', req.body)
    req.body.owner = req.user._id
    // name field could be key or original name from req.file
    req.body.name = req.file.originalname
    // File type
    req.body.type = req.file.mimetype
    // console.log('body', req.body)
    // console.log('userId', req.user._id)
    req.body.awsKey = req.file.key
    File.create(req.body)
        .then(handle404)
        .then(file => {
            res.status(201).json({ file: file.toObject() })
        })
        .catch(next)
})


// UPDATE
// PATCH /files/5a7db6c74d55bc51bdf39793
router.patch('/files/:id', requireToken, removeBlanks, (req, res, next) => {
	// if the client attempts to change the `owner` property by including a new
	// owner, prevent that by deleting that key/value pair
	delete req.body.file.owner

	File.findById(req.params.id)
		.then(handle404)
		.then((file) => {
			// pass the `req` object and the Mongoose record to `requireOwnership`
			// it will throw an error if the current user isn't the owner
			requireOwnership(req, file)

			// pass the result of Mongoose's `.update` to the next `.then`
			return file.updateOne(req.body.file)
		})
		// if that succeeded, return 204 and no JSON
		.then(() => res.sendStatus(204))
		// if an error occurs, pass it to the handler
		.catch(next)
})

// DESTROY
// DELETE /files/5a7db6c74d55bc51bdf39793
router.delete('/files/:id', requireToken, async (req, res, next) => {
	File.findById(req.params.id)
		.then(handle404)
		.then(async file => {
            console.log(file.awsKey)
            console.log(process.env.AWS_S3_BUCKET_NAME)
            // details on the latest delete method through AWS: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html
            await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: file.awsKey}, (err, data) => {
                console.error(err)
                console.log(data)
            }))
            return file
		})
        .then(file => {
            // throw an error if current user doesn't own `file`
			// requireOwnership(req, file)
			// delete the file ONLY IF the above didn't throw
			file.deleteOne()
        })
		// send back 204 and no content if the deletion succeeded
		.then(() => res.sendStatus(204))
		// if an error occurs, pass it to the handler
		.catch(next)
})

// Download
// GET /files/5a7db6c74d55bc51bdf39793
// !Add requireToken back in
router.get('/files/download/:id', async (req, res, next) => {
	File.findById(req.params.id)
		.then(handle404)
		.then(async file => {
            const data = await s3.send(new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: file.awsKey}))
            const { Body } = await s3.send(new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: file.awsKey}))
            // await data.Body.transformToString()

            // res.set('Content-Type', data.ContentType); 
            // res.set('Content-Disposition', `attachment; filename="${data.Metadata.originalname}"`)
            // console.log(data.Body)
            res.writeHead(200, {
                'Content-Type': data.ContentType
            })
            Body.pipe(res)
            // res.send(data.Body)
            // return data
                
            //     (err, data) => {
            //     console.error(err)
            //     console.log('data', data)
            // }))
            // console.log('this is the file', file)
            // return file
		})
		// send back 204 and no content if the deletion succeeded
		// .then(() => res.sendStatus(200))
		// if an error occurs, pass it to the handler
		.catch(next)

        // Download the file from S3 const file = await s3.getObject(params).promise(); // Set the response headers for the file 
; // Send the file to the client res.send(file.Body); } catch (error) { console.error(error); res.status(500).send('Error downloading file'); } });
})

module.exports = router
