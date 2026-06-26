def generate_insights(glucose, heart_rate):
    alerts = []

    # Alerts
    if glucose > 125:
        alerts.append({
            "code": "DIABETES_RISK",
            "severity": "high"
        })

    if heart_rate > 100:
        alerts.append({
            "code": "TACHYCARDIA_ALERT",
            "severity": "medium"
        })

    # Health score
    health_score = 100

    if glucose > 125:
        health_score -= 20
    if heart_rate > 100:
        health_score -= 15
    if heart_rate < 50:
        health_score -= 10

    # Status (NEW 🔥)
    if health_score >= 80:
        status = "Healthy"
    elif health_score >= 60:
        status = "Moderate"
    else:
        status = "Critical"

    return health_score, alerts, status