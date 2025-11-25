Backend minimal DB schema and API contract for evolving profile instrumentation

Overview
- Keep PO algorithm on client as baseline.
- Collect profile snapshots and session outcomes from the frontend to enable server-side analytics and later model training.

DB Schema (minimal)

1) profiles
- id (pk)
- user_id (nullable if single-user demo)
- sex
- age
- current_weight_kg
- height_cm
- created_at
- updated_at

2) profile_versions
- id (pk)
- profile_id (fk)
- snapshot_json (jsonb) -- full profile snapshot including goals and modifiers
- effective_date (date)
- source (enum: 'user'|'auto')
- notes
- created_at

3) sessions
- id (pk)
- user_id
- date (date)
- day_type
- calories
- finished (bool)
- rec_meta (jsonb) -- recommendation payload served with session
- created_at
- updated_at

4) sets
- id (pk)
- session_id (fk)
- exercise (text)
- set_number (int)
- rec_weight (float)
- rec_reps (int)
- actual_weight (float)
- actual_reps (int)
- intensity (float)
- done (bool)
- created_at

5) recommendations
- id (pk)
- user_id
- exercise
- rec_payload (jsonb)
- rec_source (text)
- created_at

6) feedback_events
- id (pk)
- user_id
- ref_type (enum: 'recommendation'|'session')
- ref_id
- helpful (bool)
- notes (text)
- created_at

API Contracts (examples)

POST /api/profile_versions
- Body:
  {
    "user_id": "user-123",
    "snapshot": { "weightKg": 70, "heightCm": 188, "age": 20, "sex": "male", "idealWeightGoal": 85 },
    "effective_date": "2025-11-24",
    "source": "user"
  }
- Response: 201 { id }

POST /api/session
- Body (extended):
  {
    "user_id": "user-123",
    "date": "2025-11-24T12:34:00Z",
    "day_type": "Chest",
    "finished": true,
    "calories": 2600,
    "sets": [
      {
        "exercise": "Incline Dumbbell Press",
        "set_number": 1,
        "rec_weight": 18.5,
        "rec_reps": 6,
        "actual_weight": 18.5,
        "actual_reps": 6,
        "intensity": 7
      }
    ],
    "rec_meta": { /* full rec payload provided to user */ }
  }
- Response: 201 { session_id }

POST /api/feedback
- Body:
  {
    "user_id": "user-123",
    "ref_type": "recommendation",
    "ref_id": "rec-456",
    "helpful": true,
    "notes": "felt right"
  }
- Response: 200 OK

POST /api/instrument (lightweight ingest)
- Body: { type: 'profile_snapshot'|'session_submitted'|'session_finished', payload: { ... } }
- Response: 200 OK

GET /api/analytics?user_id=user-123&range=30d
- Response: {
    prs: { "Incline Dumbbell Press": 40, ... },
    plateaus: [...],
    weekly_summary: [ { weekStart: '2025-11-17', kg_delta: 0.8, avg_calories: 2550 }, ... ]
  }

Notes on implementation
- Initially implement POST /api/instrument as a lightweight collector (accepts events and writes into DB table `instrument_events` or forwards to a queue for batch processing).
- Build analytics as nightly or weekly batch jobs that read sessions & profile_versions to compute PRs, plateaus, and adaptive modifiers.
- Privacy: ensure opt-in for analytics; include data retention policy and encryption in transit/at rest.

Adaptive modifier (starter)
- Weekly job computes per-exercise success rates (actual_reps >= rec_reps at rec_weight).
- If success_rate >= 0.8 for 2 consecutive weeks -> add small multiplier +2.5% to that exercise's base for next week.
- If success_rate < 0.5 -> reduce by 2.5% or drop reps by 1.
- Store modifiers in `profile_versions` or a `adaptive_modifiers` table for auditability.

Deployment
- Keep endpoints versioned; start with rules-only recommendations and an adaptive modifier overlay.
- As data accumulates, train offline models to propose modifier values and evaluate with A/B testing.
