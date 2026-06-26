/**
 * Lumiere Server
 * Entry point for the clinical data defragmentation engine.
 */

const express = require('express');
const cors = require('cors');
const clinicalController = require('./controllers/clinicalController');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' })); // Allow all for local dev
app.use(express.json());

// Clinical Ingestion Routes
app.post('/api/ingest', (req, res) => clinicalController.ingest(req, res));
app.get('/api/records', (req, res) => clinicalController.getRecords(req, res));
app.get('/api/records/:id', (req, res) => clinicalController.getRecordById(req, res));

// HITL (Human-in-the-Loop) Routes
app.get('/api/hitl/queue', (req, res) => clinicalController.getQueue(req, res));
app.post('/api/hitl/resolve', (req, res) => clinicalController.resolveQueue(req, res));

// Health Check
app.get('/health', (req, res) => res.json({ status: 'active', engine: 'Lumiere Core v1.0.0' }));

app.listen(PORT, () => {
    console.log(`
🚀 LUMIERE ENGINE ONLINE
-------------------------
PORT: ${PORT}
STATUS: READY FOR DATA SYNTHESIS
    `);
});
