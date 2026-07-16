const cron = require('node-cron');
const { generateDeadlineReminders, APP_TIMEZONE } = require('./deadlineReminders');

let task;

const runAndLog = async () => {
    try {
        const summary = await generateDeadlineReminders();
        console.log('Deadline reminders:', JSON.stringify(summary));
        return summary;
    } catch (error) {
        console.error('Deadline reminder job failed:', error.message);
        return null;
    }
};

const startDeadlineReminderScheduler = () => {
    if (process.env.NODE_ENV === 'test' || process.env.ENABLE_DEADLINE_REMINDER_JOB !== 'true' || task) return task;
    const expression = process.env.DEADLINE_REMINDER_CRON || '0 8 * * *';
    task = cron.schedule(expression, runAndLog, { timezone: APP_TIMEZONE });
    if (process.env.RUN_DEADLINE_REMINDERS_ON_START === 'true') setImmediate(runAndLog);
    return task;
};

const stopDeadlineReminderScheduler = () => {
    if (task) task.stop();
    task = undefined;
};

module.exports = { startDeadlineReminderScheduler, stopDeadlineReminderScheduler, runAndLog };
