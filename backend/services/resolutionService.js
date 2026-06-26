/**
 * Resolution Service
 * Implements Probabilistic Entity Resolution to identify duplicate patients.
 */

class ResolutionService {
    constructor() {
        this.THRESHOLD_MERGE = 0.95; // Auto-merge above this
        this.THRESHOLD_QUEUE = 0.50; // HITL Queue between these
    }

    /**
     * Finds the best match for an incoming patient in the existing Golden Records.
     * @param {Object} incomingRecord 
     * @param {Array} goldenRecords 
     * @returns {Object} { match: Record|null, score: number, status: 'new'|'merge'|'hitl' }
     */
    resolve(incomingRecord, goldenRecords) {
        let bestMatch = null;
        let highestScore = 0;

        for (const record of goldenRecords) {
            const score = this._calculateSimilarity(incomingRecord, record);
            if (score > highestScore) {
                highestScore = score;
                bestMatch = record;
            }
        }

        console.log(`[Resolution] Best match score: ${highestScore.toFixed(2)} for ${incomingRecord.name}`);

        if (highestScore >= this.THRESHOLD_MERGE) {
            return { match: bestMatch, score: highestScore, status: 'merge' };
        } 
        
        if (highestScore >= this.THRESHOLD_QUEUE) {
            return { match: bestMatch, score: highestScore, status: 'hitl' };
        }

        return { match: null, score: highestScore, status: 'new' };
    }

    /**
     * Simple weighted similarity calculation.
     * In a real system, this would use a transformer or Jaro-Winkler.
     */
    _calculateSimilarity(rec1, rec2) {
        let matches = 0;
        let totalWeights = 0;

        const weights = {
            name: 0.4,
            ssn: 0.5,
            birthDate: 0.1
        };

        // Name Similarity (word overlap with fuzzy weighting)
        if (rec1.name && rec2.name) {
            const n1Words = rec1.name.toLowerCase().split(/\s+/);
            const n2Words = rec2.name.toLowerCase().split(/\s+/);
            
            let nameMatch = 0;
            for (const w1 of n1Words) {
                for (const w2 of n2Words) {
                    if (w1 === w2) {
                        nameMatch += 1;
                        break;
                    } else if (w1.includes(w2) || w2.includes(w1)) {
                        nameMatch += 0.7; // Partial match penalty
                        break;
                    }
                }
            }
            const wordScore = nameMatch / Math.max(n1Words.length, n2Words.length);
            
            matches += wordScore * weights.name;
            totalWeights += weights.name;
        }

        // SSN Similarity (exact)
        if (rec1.identifiers?.ssn && rec2.identifiers?.ssn) {
            if (rec1.identifiers.ssn === rec2.identifiers.ssn) matches += weights.ssn;
            totalWeights += weights.ssn;
        }

        // DOB Similarity
        if (rec1.birthDate && rec2.birthDate) {
            if (rec1.birthDate === rec2.birthDate) matches += weights.birthDate;
            totalWeights += weights.birthDate;
        }

        return totalWeights > 0 ? matches / totalWeights : 0;
    }
}

module.exports = new ResolutionService();
