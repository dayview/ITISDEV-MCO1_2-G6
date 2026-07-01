require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./config/db');
// const applicationsRouter = require('./routes/applications'); remove comment once implemented

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../gems')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../gems/views/student/login.html'));
});

// app.use('/api', applicationsRouter) remove comment once implemented

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
};

startServer();
