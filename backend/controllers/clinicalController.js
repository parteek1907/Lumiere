/**
 * Clinical Controller
 * Coordinates ingestion, resolution, and HITL state management.
 */

const normalizationService = require('../services/normalizationService');
const resolutionService = require('../services/resolutionService');

// In-memory "Golden Record" store
const goldenRecords = [
    {
        id: 'P001',
        name: 'John Doe',
        mrn: 'MRN-1001',
        dob: '1990-01-01',
        gender: 'Male',
        completeness: 85,
        lastUpdatedAt: new Date().toISOString(),
        tags: ['Stable'],
        sources: ['EHR', 'Lab']
    },
    {
        id: 'P002',
        name: 'Jane Smith',
        mrn: 'MRN-1002',
        dob: '1985-05-12',
        gender: 'Female',
        completeness: 92,
        lastUpdatedAt: new Date().toISOString(),
        tags: ['Critical Audit'],
        sources: ['EHR', 'Pharmacy']
    }
];
const hitlQueue = [];

class ClinicalController {
    ingest(req, res) {
        try {
            const rawData = req.body;
            const normalized = normalizationService.normalize(rawData);

            // Run Entity Resolution
            const result = resolutionService.resolve(normalized, goldenRecords);

            if (result.status === 'merge') {
                console.log(`[Resolution] Auto-merging record for ${normalized.name}`);
                const index = goldenRecords.findIndex(r => r.id === result.match.id);
                // Simple merge: append source and update timestamp
                goldenRecords[index] = {
                    ...goldenRecords[index],
                    mergedSources: [...(goldenRecords[index].mergedSources || []), normalized.source],
                    lastUpdatedAt: new Date().toISOString()
                };
                return res.status(200).json({ status: 'merged', recordId: result.match.id });
            }

            if (result.status === 'hitl') {
                console.log(`[Resolution] LOW CONFIDENCE: Routing ${normalized.name} to HITL Queue (Score: ${result.score.toFixed(2)})`);
                const queueItem = {
                    id: normalized.id,
                    incoming: normalized,
                    potentialMatch: result.match,
                    score: result.score,
                    status: 'pending_review'
                };
                hitlQueue.push(queueItem);
                return res.status(202).json({ status: 'queued_for_review', queueId: queueItem.id });
            }

            // New Patient
            console.log(`[Resolution] New Patient detected: ${normalized.name}`);
            goldenRecords.push({
                ...normalized,
                mergedSources: [normalized.source],
                lastUpdatedAt: new Date().toISOString()
            });
            return res.status(201).json({ status: 'created', recordId: normalized.id });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Ingestion failed' });
        }
    }

    getRecords(req, res) {
        res.json(goldenRecords);
    }

    getQueue(req, res) {
        res.json(hitlQueue);
    }

    getRecordById(req, res) {
        const { id } = req.params;
        const record = goldenRecords.find(r => r.id === id);
        if (!record) return res.status(404).json({ error: 'Record not found' });
        res.json(record);
    }

    resolveQueue(req, res) {
        const { queueId, action, alias, preferredName } = req.body; 
        const index = hitlQueue.findIndex(q => q.id === queueId);
        
        if (index === -1) return res.status(404).json({ error: 'Queue item not found' });

        const item = hitlQueue[index];
        const finalName = preferredName || item.potentialMatch.name;

        if (action === 'merge') {
            const gIndex = goldenRecords.findIndex(r => r.id === item.potentialMatch.id);
            if (gIndex !== -1) {
                goldenRecords[gIndex].mergedSources.push(item.incoming.source);
                if (alias) {
                    goldenRecords[gIndex].aliases = [...(goldenRecords[gIndex].aliases || []), alias];
                }
                // Update name if preferredName provided
                if (preferredName) goldenRecords[gIndex].name = preferredName;
                goldenRecords[gIndex].lastUpdatedAt = new Date().toISOString();
            }
        } else {
            // Create New
            const newRecord = {
                ...item.incoming,
                name: preferredName || item.incoming.name,
                mergedSources: [item.incoming.source],
                lastUpdatedAt: new Date().toISOString()
            };
            goldenRecords.push(newRecord);
        }

        hitlQueue.splice(index, 1);
        res.json({ status: 'resolved', action, finalName });
    }
}

module.exports = new ClinicalController();
