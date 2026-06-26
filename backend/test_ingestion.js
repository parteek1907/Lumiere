/**
 * Lumiere Backend Test Suite (Native Fetch Edition)
 * Simulates clinical data fragmentation and synthesis.
 */

const API_BASE = 'http://localhost:3001/api';

async function runTest() {
    console.log('--- STARTING LUMIERE DATA SYNTHESIS TEST ---');

    try {
        // 1. Ingest Perfect Patient Record (Source: EHR A)
        console.log('\n[Phase 1] Ingesting Primary Record from EHR A...');
        const ehrA = await fetch(`${API_BASE}/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'ehr',
                content: {
                    name: 'Johnathan Doe',
                    birthDate: '1985-06-15',
                    identifiers: { ssn: '999-00-1234' }
                }
            })
        });
        const ehrARes = await ehrA.json();
        console.log('Result:', ehrARes);

        // 2. Ingest Duplicate Record (Source: EHR B) - Should Auto-Merge
        console.log('\n[Phase 2] Ingesting Duplicate Record from EHR B (Auto-Merge Expected)...');
        const ehrB = await fetch(`${API_BASE}/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'ehr',
                content: {
                    name: 'Johnathan Doe',
                    birthDate: '1985-06-15',
                    identifiers: { ssn: '999-00-1234' }
                }
            })
        });
        const ehrBRes = await ehrB.json();
        console.log('Result:', ehrBRes);

        // 3. Ingest PDF Lab Report with Typo (Source: Clinical Lab) - Should Trigger HITL
        console.log('\n[Phase 3] Ingesting Messy PDF Lab Report (HITL Queue Expected)...');
        const labPdf = await fetch(`${API_BASE}/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'pdf',
                content: 'Patient Name: Jon Doe\nDOB: 1985-06-15\nClinical Notes: Patient shows signs of acute fatigue.',
                metadata: { ref: 'lab-99-x' }
            })
        });
        const labPdfRes = await labPdf.json();
        console.log('Result:', labPdfRes);

        // 4. Verify Golden Records
        console.log('\n[Final Check] Retrieving Unified Golden Patient Records...');
        const recordsRes = await fetch(`${API_BASE}/records`);
        const records = await recordsRes.json();
        console.log('Golden Records Count:', records.length);
        console.log('Merged Sources for Record 1:', records[0].mergedSources);

        // 5. Verify HITL Queue
        console.log('\n[Final Check] Retrieving Uncertainty Queue...');
        const queueRes = await fetch(`${API_BASE}/hitl/queue`);
        const queue = await queueRes.json();
        console.log('Queue Length:', queue.length);
        if (queue.length > 0) {
            console.log('Item in Queue:', queue[0].incoming.name, 'vs', queue[0].potentialMatch.name);
        }

    } catch (error) {
        console.error('Test Failed:', error.message);
        console.log('\nNOTE: Make sure the server is running on port 3001!');
    }
}

runTest();
