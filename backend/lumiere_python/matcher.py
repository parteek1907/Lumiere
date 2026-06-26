from thefuzz import fuzz

def compute_match_score(name1, name2, dob1, dob2):
    # MUCH BETTER MATCHING
    name_score = fuzz.token_set_ratio(name1.lower(), name2.lower()) / 100
    dob_score = 1 if dob1 == dob2 else 0

    # stronger weight on name
    final_score = 0.8 * name_score + 0.2 * dob_score

    return final_score


def is_match(name1, name2, dob1, dob2, threshold=0.5):
    score = compute_match_score(name1, name2, dob1, dob2)
    return score >= threshold, score