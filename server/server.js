require('dotenv').config();
const MongoStore = require('connect-mongo');
const express = require('express');
const session = require('express-session');
const path = require('path');
const connectDB = require('./config/db'); // not sure if this is correct, but will change if not
// const applicationsRouter = require('./routes/applications'); remove comment once implemented

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../gems/public')));

connectDB();

// app.use('/api', applicationsRouter) remove comment once implemented

app.get('/', (req, res) => {
    res.sendFile(path.join)
})