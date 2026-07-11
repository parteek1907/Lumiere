# 🩺 Lumiere: AI-Powered Patient Identity Resolution

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square\&logo=next.js\&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square\&logo=react\&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?style=flat-square\&logo=fastapi\&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-316192?style=flat-square\&logo=postgresql\&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=flat-square\&logo=tailwindcss\&logoColor=white)
![AI/ML](https://img.shields.io/badge/AI%2FML-Hybrid%20Matching-8B5CF6?style=flat-square)

**An AI-powered patient identity resolution platform that intelligently detects, prevents, and resolves duplicate medical records through hybrid matching, confidence-based decisioning, and privacy-first data processing.**

</div>

---

# 📌 Project Overview

Lumiere is a hackathon-built healthcare intelligence prototype focused on solving one of the most persistent problems in hospital systems: fragmented and duplicate patient records.

The platform performs real-time duplicate detection during patient registration by combining deterministic comparison, fuzzy matching, weighted confidence scoring, and human-in-the-loop validation workflows.

Instead of relying purely on manual verification or post-processing cleanup, Lumiere shifts identity resolution toward proactive duplicate prevention while maintaining privacy-first processing principles.

Built by a team of 4 first-year engineering students.

---

# 🏗️ Architecture

Lumiere follows a lightweight multi-service architecture:

| Service            | Technology                    | Description                                                |
| :----------------- | :---------------------------- | :--------------------------------------------------------- |
| **Frontend**       | Next.js + React + TailwindCSS | Doctor dashboard & patient management UI                   |
| **Backend API**    | FastAPI + Python              | Registration flow, matching orchestration, review handling |
| **Database Layer** | PostgreSQL                    | Patient records, review queue, merge tracking              |
| **AI Layer**       | Hybrid AI/ML Matching         | Duplicate detection & confidence scoring                   |

---

# 🧠 How It Works

```text
Doctor Login
      ↓
Register Patient
      ↓
Secure Data Transformation
      ↓
AI Matching Engine
      ↓
Confidence Score Generation
      ↓
 ┌───────────────┬───────────────┬───────────────┐
 │ High Score     │ Medium Score  │ Low Score     │
 └──────┬────────┴──────┬────────┴──────┬────────┘
        ↓               ↓               ↓
 Auto Merge     Send to Review Queue   Create New Record
        ↓               ↓
   Update DB      Doctor Review
                        ↓
                 Merge / Reject
```

---

# ✨ Core Features

### 🔍 Real-Time Duplicate Detection

Detects potential duplicate patient records during registration itself rather than after data entry.

### 🧠 Hybrid Matching Workflow

Combines:

* Exact matching
* Fuzzy matching
* Weighted confidence scoring
* Multi-field comparison logic

### 📊 Confidence-Based Decisions

Instead of binary matching, Lumiere generates confidence scores to determine:

* Auto merge
* Human review
* New record creation

### 👨‍⚕️ Human-in-the-Loop Review

Doctors can manually validate uncertain duplicate cases through a structured review queue.

### 🔐 Privacy-Preserving Processing

Sensitive identifiers are transformed before entering the AI matching pipeline to reduce direct exposure of personal information.

### 🏥 Doctor-Centric Dashboard

Provides:

* Patient management
* Registration workflows
* Review queue handling
* Record inspection

---

# 🛠️ Tech Stack

| Layer           | Technology                |
| --------------- | ------------------------- |
| **Frontend**    | Next.js + React           |
| **Styling**     | TailwindCSS               |
| **Backend**     | FastAPI                   |
| **Language**    | Python                    |
| **Database**    | PostgreSQL                |
| **AI Workflow** | Hybrid Matching Logic     |
| **Design**      | Modern SaaS UI Principles |

---

# 📁 Project Structure

```text
lumiere/
├── frontend/
│   ├── app/
│   ├── components/
│   └── styles/
│
├── backend/
│   ├── api/
│   ├── matching/
│   └── review/
│
├── database/
│   ├── schemas/
│   └── migrations/
│
└── docs/
```

---

# 🚀 Getting Started

## Prerequisites

* Node.js 18+
* Python 3.10+
* PostgreSQL

---

## Installation

```bash
# Clone repository
git clone <repo-url>

# Frontend setup
cd frontend
npm install

# Backend setup
cd ../backend
pip install -r requirements.txt
```

---

## Running the Application

### Frontend

```bash
npm run dev
```

### Backend

```bash
uvicorn main:app --reload
```

---

# 🛡️ Privacy & Security

Lumiere follows a privacy-first workflow where patient identifiers are transformed before entering AI processing pipelines.

The system is designed around:

* minimal direct exposure of sensitive data
* confidence-based review workflows
* human validation for uncertain cases

---

# 👥 Team & Contribution

### Team Size

4 Members

### My Contribution

* Team leadership & project coordination
* Database planning & workflow structure
* UI/UX improvements
* Research & presentation design
* System architecture discussions

---

# 📚 What I Learned

Through Lumiere, I explored:

* healthcare identity resolution systems
* privacy-preserving AI concepts
* confidence-scoring workflows
* scalable backend planning
* collaborative hackathon development
* human-in-the-loop AI systems

---

# ⚡ Project Status

Current Status:

* Local prototype only
* Prototype focused
* Focused on architecture, workflows, and system design exploration

---

<div align="center">

Built by Team Entropy.

</div>
