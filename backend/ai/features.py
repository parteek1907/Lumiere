import jellyfish
import re

def calculate_name_jaro_winkler(name1, name2):
    return jellyfish.jaro_winkler_similarity(name1.lower(), name2.lower())

def calculate_name_phonetic(name1, name2):
    # Both Soundex and NYSIIS are common for names
    s1_soundex = jellyfish.soundex(name1)
    s2_soundex = jellyfish.soundex(name2)
    s1_nysiis = jellyfish.nysiis(name1)
    s2_nysiis = jellyfish.nysiis(name2)
    
    if s1_soundex == s2_soundex or s1_nysiis == s2_nysiis:
        return 1.0
    return 0.0

def calculate_dob_score(dob1, dob2):
    if not dob1 or not dob2:
        return 0.0
    if dob1 == dob2:
        return 1.0
    
    # Check for day/month transposition (e.g., 1990-01-04 vs 1990-04-01)
    parts1 = dob1.split('-')
    parts2 = dob2.split('-')
    if len(parts1) == 3 and len(parts2) == 3:
        # If year matches and [month1==day2, day1==month2]
        if parts1[0] == parts2[0] and parts1[1] == parts2[2] and parts1[2] == parts2[1]:
            return 0.7
        # Year only match
        if parts1[0] == parts2[0]:
            return 0.3
            
    return 0.0

def calculate_ssn_score(full1, full2, last4_1, last4_2):
    if full1 == full2:
        return 1.0
    if last4_1 == last4_2:
        return 0.5
    return 0.0

def normalize_address(address):
    if not address: return ""
    addr = address.lower()
    addr = re.sub(r'\bst\b', 'street', addr)
    addr = re.sub(r'\bave\b', 'avenue', addr)
    addr = re.sub(r'\bapt\b', 'apartment', addr)
    addr = re.sub(r'[^\w\s]', '', addr)
    return addr

def calculate_address_score(addr1, addr2):
    if not addr1 or not addr2:
        return 0.0
    n1 = normalize_address(addr1)
    n2 = normalize_address(addr2)
    
    tokens1 = set(n1.split())
    tokens2 = set(n2.split())
    
    if not tokens1 or not tokens2:
        return 0.0
        
    overlap = tokens1.intersection(tokens2)
    score = len(overlap) / max(len(tokens1), len(tokens2))
    return round(score, 2)

def calculate_gender_score(g1, g2):
    if not g1 or not g2:
        return 0.5
    if g1.lower() == g2.lower():
        return 1.0
    return 0.0

def is_greeting(query: str) -> bool:
    """
    Detects greetings and conversational messages.
    Handles full sentences (e.g. 'Hello, can you help?') by checking
    if the query starts with or contains a known greeting keyword,
    AND does not look like a patient name (i.e. no digits, short, no multiple words that look like a name).
    """
    GREETING_KEYWORDS = {
        "hi", "hello", "hey", "greetings", "good morning", "good afternoon",
        "good evening", "how are you", "who are you", "what are you", "help",
        "what can you do", "what do you do", "sup", "yo"
    }
    q = query.lower().strip().rstrip('?!.,')
    words = q.split()

    # Single/short keyword match
    if q in GREETING_KEYWORDS or len(q) < 2:
        return True

    # First word is a greeting keyword (e.g. "Hello, I need help")
    if words and words[0].rstrip(',') in GREETING_KEYWORDS:
        return True

    # Multi-word greeting phrases
    two_word = " ".join(words[:2]) if len(words) >= 2 else ""
    three_word = " ".join(words[:3]) if len(words) >= 3 else ""
    if two_word in GREETING_KEYWORDS or three_word in GREETING_KEYWORDS:
        return True

    return False
