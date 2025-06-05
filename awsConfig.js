const AWS = require('aws-sdk');
require('dotenv').config();

AWS.config.update({
    region: 'ap-south-1', // or your region
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY
});

const sns = new AWS.SNS();
module.exports = sns;
