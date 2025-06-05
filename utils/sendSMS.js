const sns = require('../awsConfig');

async function sendSMS(phoneNumber, message) {
    const params = {
        Message: message,
        PhoneNumber: phoneNumber,
    };

    try {
        await sns.publish(params).promise();
        console.log("SMS sent:", message);
    } catch (err) {
        console.error("Error sending SMS:", err.message);
    }
}

module.exports = sendSMS;
