const pool = require('../db');
const sendSMS = require('../utils/sendSMS');

async function sendReminders() {
    const today = new Date().getDate();
    const res = await pool.query(`
        SELECT u.phone, b.name, b.amount, b.date_of_month
        FROM bills b
        JOIN users u ON b.user_id = u.id
        WHERE b.date_of_month BETWEEN $1 AND $2
    `, [today, today + 1]);

    for (const bill of res.rows) {
        await sendSMS(bill.phone, `⏰ Reminder: ₹${bill.amount} for ${bill.name} is due on the ${bill.date_of_month}`);
    }

    console.log("✅ SMS reminders sent.");
    process.exit();
}

sendReminders();
