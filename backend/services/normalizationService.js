/**
 * Normalization Service
 * Simulates the conversion of multi-modal unstructured data into structured FHIR-lite records.
 */

const { v4: uuidv4 } = require('uuid');

class NormalizationService {
    /**
     * Normalizes raw input into a structured patient record.
     * @param {Object} input - { type: 'pdf'|'voice'|'ehr', content: string, metadata: Object }
     */
    normalize(input) {
        console.log(`[Normalization] Processing ${input.type} data...`);
        
        // In a real scenario, this would call specialized NLP/OCR models.
        // For the hackathon, we simulate extraction.
        
        const baseRecord = {
            id: uuidv4(),
            source: input.type,
            ingestedAt: new Date().toISOString(),
            rawRef: input.metadata?.ref || 'n/a'
        };

        if (input.type === 'pdf') {
            return {
                ...baseRecord,
                resourceType: 'Patient',
                name: this._parseName(input.content),
                birthDate: this._parseDOB(input.content),
                gender: this._parseGender(input.content),
                identifiers: {
                    ssn: this._regexMatch(input.content, /\b\d{3}-\d{2}-\d{4}\b/),
                    phone: this._regexMatch(input.content, /\b\d{3}-\d{3}-\d{4}\b/),
                }
            };
        }

        if (input.type === 'voice') {
            return {
                ...baseRecord,
                resourceType: 'Observation', // Voice notes often contain observations
                patientName: this._parseName(input.content),
                note: input.content,
                category: 'clinical-note'
            };
        }

        // Default EHR structured input (already mostly normalized)
        return {
            ...baseRecord,
            ...input.content
        };
    }

    _parseName(text) {
        const match = text.match(/Patient Name:\s*([^\n\r]+)/i);
        return match ? match[1].trim() : 'Unknown';
    }

    _parseDOB(text) {
        const match = text.match(/DOB:\s*(\d{4}-\d{2}-\d{2})/i);
        return match ? match[1] : null;
    }

    _parseGender(text) {
        if (/female/i.test(text)) return 'female';
        if (/male/i.test(text)) return 'male';
        return 'other';
    }

    _regexMatch(text, regex) {
        const match = text.match(regex);
        return match ? match[0] : null;
    }
}

module.exports = new NormalizationService();
