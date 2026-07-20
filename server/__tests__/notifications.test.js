jest.mock('../models/Notification');
jest.mock('../lib/deadlineReminders', () => ({
    getDaysUntilDeadline: jest.fn(() => 3),
    generateDeadlineReminders: jest.fn(async () => ({ createdReminders: 1 }))
}));

const Notification = require('../models/Notification');
const notificationRouter = require('../routes/notifications');
const reminderRouter = require('../routes/reminders');
const { generateDeadlineReminders } = require('../lib/deadlineReminders');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const handlers = (router, method, path) => router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.map(layer => layer.handle);

describe('Notification API ownership', () => {
    beforeEach(() => jest.clearAllMocks());

    test('unauthenticated notification list returns 401', () => {
        const middleware = notificationRouter.stack[0].handle;
        const res = mockRes();
        middleware({ session: {} }, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('student list query and unread count are scoped to the session user', async () => {
        const [handler] = handlers(notificationRouter, 'get', '/');
        const chain = { sort: jest.fn(), skip: jest.fn(), limit: jest.fn() };
        chain.sort.mockReturnValue(chain);
        chain.skip.mockReturnValue(chain);
        chain.limit.mockResolvedValue([]);
        Notification.find.mockReturnValue(chain);
        Notification.countDocuments.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
        const req = { user: { _id: 'student-a', role: 'Student' }, query: {} };
        const res = mockRes();
        await handler(req, res, jest.fn());
        expect(Notification.find).toHaveBeenCalledWith({ userId: 'student-a' });
        expect(Notification.countDocuments).toHaveBeenLastCalledWith({ userId: 'student-a', isRead: false });
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ meta: expect.objectContaining({ total: 2, unread: 1 }) }));
    });

    test('mark one uses both notification id and session user id', async () => {
        const [handler] = handlers(notificationRouter, 'patch', '/:id/read');
        Notification.findOneAndUpdate.mockResolvedValue(null);
        const id = '507f1f77bcf86cd799439011';
        const res = mockRes();
        await handler({ params: { id }, user: { _id: 'student-b' } }, res, jest.fn());
        expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: id, userId: 'student-b' }, expect.any(Object), { new: true }
        );
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('mark all only updates the logged-in student', async () => {
        const [handler] = handlers(notificationRouter, 'patch', '/read-all');
        Notification.updateMany.mockResolvedValue({ modifiedCount: 2 });
        const res = mockRes();
        await handler({ user: { _id: 'student-a' } }, res, jest.fn());
        expect(Notification.updateMany).toHaveBeenCalledWith(
            { userId: 'student-a', isRead: false }, expect.any(Object)
        );
    });
});

describe('Manual reminder generation authorization', () => {
    beforeEach(() => jest.clearAllMocks());
    const routeHandlers = handlers(reminderRouter, 'post', '/run');

    test('unauthenticated users cannot run generation', () => {
        const res = mockRes();
        routeHandlers[0]({ session: {} }, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('students cannot run generation', () => {
        const res = mockRes();
        routeHandlers[1]({ user: { role: 'Student' } }, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(403);
    });

    test('admins can run generation', async () => {
        const res = mockRes();
        await routeHandlers[2]({}, res, jest.fn());
        expect(generateDeadlineReminders).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ success: true, data: { createdReminders: 1 } });
    });
});
