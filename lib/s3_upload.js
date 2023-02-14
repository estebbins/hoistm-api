// Copied from https://git.generalassemb.ly/sei-ec-remote/c2c-image-upload-api/blob/training/lib/s3_upload.js 

require('dotenv').config()
// const AWS = require('aws-sdk')
// const s3 = new AWS.S3()

// module.exports = function (file) {
//   const params = {
//     Bucket: 'hoistm-cloud-system',
//     Key: new Date().getTime() + '_' + file.originalname,
//     Body: file.buffer,
//     ACL: 'public-read'
//   }
//   return s3.upload(params).promise()
// }

const AWS = require('aws-sdk')
const uuid = require('uuid')
const s3 = new AWS.S3({ 
    accessKeyId: process.env.AWS_ACCESS_KEY_ID, 
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, 
    region: process.env.AWS_REGION
})
// function uploadFileToS3(file) { 
//     return new Promise((resolve, reject) => { 
//         const fileStream = file.createReadStream()
//         const extension = file.originalname.split('.').pop()
//         const filename = uuid.v4() + '.' + extension
//         const uploadParams = { 
//             Bucket: process.env.AWS_BUCKET_NAME, 
//             Key: filename, 
//             Body: file.fileStream,
//             ACL: 'public-read' 
//         } 
//         s3.upload(uploadParams, (err, data) => { 
//             if (err) { 
//                 reject(err) 
//             } else { resolve(data.Location) } 
//         })
//     }) 
// } 

const fs = require('fs');
const path = require('path');

const uploadFileToS3 = async (filePath, key) => {
    const fileStream = fs.createReadStream(filePath);
  
    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: fileStream,
    };
  
    const result = await s3.upload(uploadParams).promise();
  
    fs.unlinkSync(filePath);
  
    return result.Location;
  };
  
            
module.exports = uploadFileToS3 