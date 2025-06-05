const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const sendPushNotification = require('../utils/sendPushNotification');
const sendSMS = require('../utils/sendSMS');
router.use(authMiddleware);

// GET bills for logged-in user
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM bills WHERE user_id = $1 ORDER BY date_of_month',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// GET a single bill by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM bills WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bill not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});


// POST new bill
router.post('/', async (req, res) => {
    const {
        name,
        amount,
        date_of_month,
        specific_date,
        notification_hours_before
    } = req.body;

    console.log('Creating new bill with data:', {
        name,
        amount,
        date_of_month,
        specific_date,
        notification_hours_before
    });

    try {
        const result = await pool.query(
            `INSERT INTO bills
            (user_id, name, amount, date_of_month, specific_date, notification_hours_before, notification_sent)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                req.user.id,
                name,
                amount,
                date_of_month,
                specific_date || null,
                notification_hours_before || 3,
                false
            ]
        );

        console.log('Bill created successfully:', result.rows[0]);

        // Immediately check if this bill should trigger a notification
        if (specific_date) {
            const now = new Date();
            const billDate = new Date(specific_date);
            const timeDiff = billDate.getTime() - now.getTime();
            const hoursDiff = Math.ceil(timeDiff / (1000 * 3600));

            console.log('Time difference for new bill:', {
                now: now.toISOString(),
                billDate: billDate.toISOString(),
                timeDiffMs: timeDiff,
                hoursDiff: hoursDiff,
                notificationHoursBefore: notification_hours_before || 3
            });

            if (hoursDiff <= (notification_hours_before || 3)) {
                console.log('This bill is due soon or past due! Should trigger notification.');
            }
        }

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});
// DELETE a bill
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM bills WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// UPDATE a bill
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
        name,
        amount,
        date_of_month,
        specific_date,
        notification_hours_before,
        notification_sent
    } = req.body;

    try {
        const result = await pool.query(
            `UPDATE bills
            SET name = $1,
                amount = $2,
                date_of_month = $3,
                specific_date = $4,
                notification_hours_before = $5,
                notification_sent = $6
            WHERE id = $7 AND user_id = $8
            RETURNING *`,
            [
                name,
                amount,
                date_of_month,
                specific_date,
                notification_hours_before || 3,
                notification_sent !== undefined ? notification_sent : false,
                id,
                req.user.id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bill not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});
// 🔔 POST /api/bills/remind - This is now handled by the enhanced version below


router.post('/remind', async (req, res) => {
  const userId = req.user.id;

  try {
    const now = new Date();
    const today = now.getDate();
    const tomorrow = today + 1;

    console.log('Running bill reminders check at:', now.toISOString());
    console.log('Today is day:', today, 'Tomorrow is day:', tomorrow);

    // Query for bills with specific dates coming up
    const specificDateBills = await pool.query(
      `SELECT id, name, amount, specific_date, notification_hours_before, notification_sent
       FROM bills
       WHERE user_id = $1
         AND specific_date IS NOT NULL
         AND notification_sent = false
         AND specific_date <= (CURRENT_DATE + INTERVAL '2 days')`,
      [userId]
    );

    console.log('Found specific date bills:', specificDateBills.rows);

    // Query for recurring monthly bills based on day of month
    const recurringBills = await pool.query(
      `SELECT id, name, amount, date_of_month, notification_hours_before, notification_sent
       FROM bills
       WHERE user_id = $1
         AND specific_date IS NULL
         AND date_of_month BETWEEN $2 AND $3
         AND notification_sent = false`,
      [userId, today, tomorrow]
    );

    console.log('Found recurring bills:', recurringBills.rows);

    // Combine both types of bills
    const allBillsDue = [...specificDateBills.rows, ...recurringBills.rows];

    console.log('Total bills to process:', allBillsDue.length);

    if (allBillsDue.length > 0) {
      // Get user information including FCM token
      const user = await pool.query(
        'SELECT phone, fcm_token FROM users WHERE id = $1',
        [userId]
      );

      const phone = user.rows[0].phone;
      const fcmToken = user.rows[0].fcm_token;

      console.log('User phone:', phone ? 'Available' : 'Not available');
      console.log('User FCM token:', fcmToken ? 'Available' : 'Not available');

      // Process each bill due
      for (const bill of allBillsDue) {
        console.log('Processing bill:', bill);

        let dueDate;
        let dueMessage;
        let shouldSendNotification = true;

        if (bill.specific_date) {
          // Format the specific date
          const specificDate = new Date(bill.specific_date);
          dueDate = specificDate.toLocaleDateString();

          // Calculate if it's time to send notification based on hours_before
          const timeDiff = specificDate.getTime() - now.getTime();
          const hoursDiff = Math.ceil(timeDiff / (1000 * 3600));

          console.log('Bill time difference:', {
            billId: bill.id,
            billName: bill.name,
            specificDate: specificDate.toISOString(),
            timeDiffMs: timeDiff,
            hoursDiff: hoursDiff,
            notificationHoursBefore: bill.notification_hours_before
          });

          // Only send notification if we're within the notification window
          if (hoursDiff > bill.notification_hours_before) {
            console.log(`Skipping bill ${bill.id} - not within notification window yet`);
            shouldSendNotification = false;
          } else {
            console.log(`Bill ${bill.id} is due soon or past due - should send notification`);
          }

          dueMessage = `due on ${dueDate}`;
        } else {
          dueMessage = `due on the ${bill.date_of_month}th`;
        }

        if (!shouldSendNotification) {
          continue;
        }

        // Send SMS if phone is available
        if (phone) {
          console.log(`Sending SMS for bill ${bill.id}`);
          await sendSMS(phone, `🔔 Reminder: ₹${bill.amount} for ${bill.name} is ${dueMessage}`);
        }

        // Send web push notification if FCM token is available
        if (fcmToken) {
          console.log(`Sending push notification for bill ${bill.id}`);
          await sendPushNotification(
            fcmToken,
            'Bill Payment Reminder',
            `₹${bill.amount} for ${bill.name} is ${dueMessage}`,
            {
              billName: bill.name,
              billAmount: bill.amount,
              billDate: bill.specific_date || bill.date_of_month
            }
          );
        }

        // Mark this bill as notified
        console.log(`Marking bill ${bill.id} as notified`);
        await pool.query(
          'UPDATE bills SET notification_sent = true WHERE id = $1',
          [bill.id]
        );
      }

      return res.json({ sent: true, count: allBillsDue.length });
    }

    console.log('No bills to send notifications for');
    res.json({ sent: false });
  } catch (err) {
    console.error('Reminder error:', err);
    res.status(500).send("Server error");
  }
});

router.post('/test-notification', async (req, res) => {
  const userId = req.user.id;

  try {
    // Get user information including FCM token
    const user = await pool.query(
      'SELECT phone, fcm_token FROM users WHERE id = $1',
      [userId]
    );

    const fcmToken = user.rows[0].fcm_token;

    if (!fcmToken) {
      return res.json({ sent: false, error: 'No FCM token found for this user' });
    }

    // Send test web push notification
    await sendPushNotification(
      fcmToken,
      'Test Notification',
      'This is a test notification from your expense tracker app.',
      {
        test: true,
        timestamp: new Date().toISOString()
      }
    );

    return res.json({ sent: true });
  } catch (err) {
    console.error('Test notification error:', err);
    res.status(500).json({ sent: false, error: err.message });
  }
});

// Reset notification status for all bills
router.post('/reset-notifications', async (req, res) => {
  const userId = req.user.id;

  try {
    // Reset notification_sent status for all bills
    const result = await pool.query(
      'UPDATE bills SET notification_sent = false WHERE user_id = $1 RETURNING id',
      [userId]
    );

    return res.json({
      success: true,
      message: `Reset notification status for ${result.rowCount} bills`
    });
  } catch (err) {
    console.error('Error resetting notifications:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simple test route to check if changes are being applied
router.get('/test-route', (req, res) => {
  console.log('Test route accessed!');
  return res.json({ success: true, message: 'Test route is working!' });
});

// Simple force notification route
router.post('/force-notification/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const billId = req.params.id;

    console.log(`Force notification request received for bill ID: ${billId} from user ID: ${userId}`);

    // Get the bill details - simplified query
    const billResult = await pool.query(
      'SELECT name, amount, date_of_month FROM bills WHERE id = $1',
      [billId]
    );

    if (billResult.rows.length === 0) {
      console.log(`Bill with ID ${billId} not found`);
      return res.json({ success: false, message: 'Bill not found' });
    }

    const bill = billResult.rows[0];
    console.log('Bill found:', bill);

    // Get user FCM token
    const userResult = await pool.query(
      'SELECT fcm_token FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].fcm_token) {
      console.log('FCM token not found for user');
      return res.json({ success: false, message: 'FCM token not found' });
    }

    const fcmToken = userResult.rows[0].fcm_token;
    console.log('FCM token found:', fcmToken ? 'Available' : 'Not available');

    // Send a simple test notification
    await sendPushNotification(
      fcmToken,
      'Test Bill Notification',
      `Test reminder for ${bill.name} (₹${bill.amount})`,
      {
        test: true,
        billId: billId,
        timestamp: new Date().toISOString()
      }
    );

    console.log('Notification sent successfully');
    return res.json({
      success: true,
      message: `Test notification sent for bill: ${bill.name}`
    });
  } catch (err) {
    console.error('Error in force notification:', err);
    return res.json({ success: false, error: err.message });
  }
});
module.exports = router;
