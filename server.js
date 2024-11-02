const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();
const PORT = 8000;

// MongoDB Atlas Configuration
const mongoURI = 'mongodb+srv://MohanishX:MohanishX@mohanishx-datacenter.ayj0u.mongodb.net/MohanishX-DataCenter?retryWrites=true&w=majority';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

const imdbApiBaseUrl = 'https://imdb-api.mohanishx1.workers.dev/search';

// Schema and Model for Entries
const entrySchema = new mongoose.Schema({
    imdb_code: { type: String, required: true, unique: true },
    results: [{ file_name: String, file_size: String, file_link: String }]
});
const Entry = mongoose.model('Entry', entrySchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'your_secret_key', resave: false, saveUninitialized: true }));
app.set('view engine', 'ejs');

// Admin Credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password'; // Replace with a strong password

// Authentication Middleware
function adminRequired(req, res, next) {
    if (!req.session.username) {
        return res.redirect('/admin/login');
    }
    next();
}

// Routes
app.get('/', (req, res) => {
    res.render('search');
});

app.get('/admin/login', (req, res) => {
    res.render('admin_login', { message: null });
});

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.username = username;
        return res.redirect('/admin');
    }
    res.render('admin_login', { message: 'Invalid username or password.' });
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/admin', adminRequired, (req, res) => {
    res.render('admin', { results: [], data: '', imdb_code: '', message: '', existing_entry: null });
});

app.post('/admin', adminRequired, async (req, res) => {
    const { data, imdb_code } = req.body;
    let message = '';

    const existingEntry = await Entry.findOne({ imdb_code });

    // Parsing data without saving to the database
    const results = parseData(data);

    // Check if entry exists and display a message
    if (existingEntry) {
        message = 'IMDb code already exists. Please confirm to update the entry.';
    }

    // Render the admin page with parsed results and confirmation checkbox
    res.render('admin', {
        results,
        data,
        imdb_code,
        message,
        existing_entry: existingEntry
    });
});

// Confirm Save Route to actually save the data in DB
app.post('/admin/confirm-save', adminRequired, async (req, res) => {
    const { imdb_code, confirm_update } = req.body;
    const data = req.body.data; // Pass the data again from the hidden field
    const results = parseData(data); // Parse data again if needed

    const existingEntry = await Entry.findOne({ imdb_code });

    if (existingEntry && !confirm_update) {
        return res.redirect('/admin');
    }

    // Save or Update Entry
    if (existingEntry) {
        await Entry.updateOne({ imdb_code }, { results });
    } else {
        await new Entry({ imdb_code, results }).save();
    }

    res.redirect('/admin');
});

app.get('/search', async (req, res) => {
    const { imdb_code } = req.query;
    const entry = await Entry.findOne({ imdb_code });
    const results = entry ? entry.results : [];
    res.render('results', { imdb_code, results });
});

// Utility Functions
function parseData(data) {
    const patternGdtot = /([^\n]+\.mkv)\s*-\s*([\d.]+\s*(?:GB|MB))\s*\n\s*(https?:\/\/[^\s]+)/g;
    const patternHubCloud = /([^\n]+\.mkv)\s*\[([\d.]+\s*(?:GB|MB))\]\s*\n\s*(https?:\/\/[^\s]+)/g;
    const patternGDFlix = /([^\n]+\.mkv)\s*\[\s*([\d.]+\s*(?:GB|MB))\s*]\s*(https?:\/\/[^\s]+)/g;

    const results = [];
    const seenLinks = new Set();

    let match;

    // Match against GDTot
    while ((match = patternGdtot.exec(data)) !== null) {
        const fileLink = match[3].trim();
        if (!seenLinks.has(fileLink)) {
            results.push({
                file_name: match[1].trim(),
                file_size: match[2].trim(),
                file_link: fileLink
            });
            seenLinks.add(fileLink);
        }
    }

    // Match against HubCloud
    while ((match = patternHubCloud.exec(data)) !== null) {
        const fileLink = match[3].trim();
        if (!seenLinks.has(fileLink)) {
            results.push({
                file_name: match[1].trim(),
                file_size: match[2].trim(),
                file_link: fileLink
            });
            seenLinks.add(fileLink);
        }
    }

    // Match against GDFlix
    while ((match = patternGDFlix.exec(data)) !== null) {
        const fileLink = match[3].trim();
        if (!seenLinks.has(fileLink)) {
            results.push({
                file_name: match[1].trim(),
                file_size: match[2].trim(),
                file_link: fileLink
            });
            seenLinks.add(fileLink);
        }
    }

    return results;
}
// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`);
});
