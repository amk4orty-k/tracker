from typing import Any, Dict, List, Optional, Tuple
import os
from datetime import datetime, timedelta
import jwt
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Query, Depends, Header
import httpx

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="Gym Tracker")

# Create Supabase client from environment variables. The project context
# indicated a Supabase client is available; we create it here from
# SUPABASE_URL and SUPABASE_KEY so the endpoint can query the DB. Make
# sure these environment variables are set before running the app.
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
	raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in environment")

# Use direct PostgREST HTTP access instead of the supabase client to avoid
# dependency conflicts with pydantic versions. This uses the project's
# REST endpoint at <SUPABASE_URL>/rest/v1 and the service key for auth.
REST_BASE = SUPABASE_URL.rstrip("/") + "/rest/v1"
DEFAULT_HEADERS = {
	"apikey": SUPABASE_KEY,
	"Authorization": f"Bearer {SUPABASE_KEY}",
	"Content-Type": "application/json",
}

# JWT secret for Supabase Auth (same as SUPABASE_KEY for service role)
JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", SUPABASE_KEY)

def get_current_user_id(authorization: Optional[str] = Header(None)) -> Tuple[str, str]:
	"""Extract user_id from JWT token in Authorization header and return token."""
	if not authorization:
		raise HTTPException(status_code=401, detail="Authorization header missing")
	
	if not authorization.startswith("Bearer "):
		raise HTTPException(status_code=401, detail="Invalid authorization format")
	
	token = authorization.replace("Bearer ", "")
	
	try:
		# Decode JWT without verification for service role (already trusted)
		payload = jwt.decode(token, options={"verify_signature": False})
		user_id = payload.get("sub")
		
		if not user_id:
			raise HTTPException(status_code=401, detail="Invalid token: no user_id")
		
		return user_id, token
	except Exception as e:
		raise HTTPException(status_code=401, detail=f"Token validation failed: {e}")


def _rest_get(table: str, select: str = "*", eq: dict = None, gte: dict = None, order: tuple = None, limit: int = None, user_token: str = None):
	params = {"select": select}
	if eq:
		for k, v in eq.items():
			params[k] = f"eq.{v}"
	if gte:
		for k, v in gte.items():
			params[k] = f"gte.{v}"
	if order:
		params["order"] = f"{order[0]}.{order[1]}"
	if limit:
		params["limit"] = str(limit)
	url = f"{REST_BASE}/{table}"
	headers = {**DEFAULT_HEADERS}
	if user_token:
		headers["Authorization"] = f"Bearer {user_token}"
	resp = httpx.get(url, params=params, headers=headers, timeout=10.0)
	resp.raise_for_status()
	return resp.json()


def _rest_post(table: str, row: dict, user_token: str = None):
	url = f"{REST_BASE}/{table}"
	headers = {**DEFAULT_HEADERS, "Prefer": "return=representation"}
	if user_token:
		headers["Authorization"] = f"Bearer {user_token}"
	resp = httpx.post(url, json=row, headers=headers, timeout=10.0)
	resp.raise_for_status()
	return resp.json()


def _rest_patch(table: str, id_value, row: dict, user_token: str = None):
	url = f"{REST_BASE}/{table}"
	params = {"id": f"eq.{id_value}"}
	headers = {**DEFAULT_HEADERS, "Prefer": "return=representation"}
	if user_token:
		headers["Authorization"] = f"Bearer {user_token}"
	resp = httpx.patch(url, params=params, json=row, headers=headers, timeout=10.0)
	resp.raise_for_status()
	return resp.json()


# Pydantic models for session logging
from pydantic import BaseModel


class SetIn(BaseModel):
	exercise: str
	set_number: int
	weight: float
	reps: int
	intensity: int


class SessionIn(BaseModel):
	date: Optional[datetime] = None
	calories: Optional[int] = 0
	day_type: Optional[str] = None
	finished: Optional[bool] = False
	sets: List[SetIn]


@app.post("/session")
def log_session(payload: SessionIn, auth_data: Tuple[str, str] = Depends(get_current_user_id)) -> Dict[str, Any]:
	"""
	Log a workout session and compute session-level metrics.
	This endpoint inserts a session row and associated sets into Supabase,
	computes PRs for exercises included in the session, average intensity,
	counts missed days in the last 7 days, and returns recommendations per exercise.
	"""
	user_id, user_token = auth_data

	# Normalize date
	session_date = payload.date or datetime.utcnow()

	# Insert session row via PostgREST
	try:
		session_row = {
			"user_id": user_id,
			"date": session_date.isoformat(),
			"calories": int(payload.calories or 0)
		}
		if payload.day_type:
			session_row["day_type"] = payload.day_type
		# Mark finished flag if provided
		session_row["finished"] = bool(payload.finished)
		sess_rows = _rest_post("sessions", session_row, user_token=user_token)
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Failed to insert session: {e}")

	# Extract inserted session id if available
	session_id = None
	if isinstance(sess_rows, list) and len(sess_rows) > 0:
		session_id = sess_rows[0].get("id")

	# Insert sets
	inserted_sets = []
	for s in payload.sets:
		set_row = {
			"session_id": session_id,
			"user_id": user_id,
			"exercise": s.exercise,
			"set_number": s.set_number,
			"weight": float(s.weight),
			"reps": int(s.reps),
			"intensity": int(s.intensity),
		}
		try:
			r = _rest_post("sets", set_row, user_token=user_token)
			if isinstance(r, list) and len(r) > 0:
				inserted_sets.append(r[0])
		except Exception:
			# continue inserting remaining sets even if one fails
			continue

	# Compute average intensity from the inserted sets (fallback to payload if none returned)
	intensities = [s.intensity for s in payload.sets]
	avg_intensity = sum(intensities) / max(1, len(intensities))

	# Compute PRs for each exercise in this session by querying max weight
	exercises = list({s.exercise for s in payload.sets})
	pr_by_exercise: Dict[str, Dict[str, Any]] = {}
	for ex in exercises:
		try:
			# Filter by both exercise and user_id
			r = _rest_get("sets", select="weight,reps,exercise", eq={"exercise": ex, "user_id": user_id}, order=("weight", "desc"), limit=1, user_token=user_token)
		except Exception:
			continue

		rowdata = r if isinstance(r, list) else None

		if rowdata and len(rowdata) > 0:
			best = rowdata[0]
			pr_by_exercise[ex] = {
				"pr_weight": float(best.get("weight", 0)),
				"pr_reps": int(best.get("reps", 0)),
			}
		else:
			pr_by_exercise[ex] = {"pr_weight": None, "pr_reps": None}

	# Missed sessions in the last 7 days: count days with no session
	today = datetime.utcnow().date()
	start_date = (today - timedelta(days=6)).isoformat()  # 7-day window including today
	try:
		sessions_last_week = _rest_get("sessions", select="date", eq={"user_id": user_id}, gte={"date": start_date}, user_token=user_token)
	except Exception:
		sessions_last_week = None

	days_with_sessions = set()
	if sessions_last_week is not None:
		data = sessions_last_week.data if hasattr(sessions_last_week, "data") else sessions_last_week.get("data")
		if data:
			for row in data:
				try:
					d = datetime.fromisoformat(row.get("date")).date()
					days_with_sessions.add(d)
				except Exception:
					continue

	missed_days_last_7 = 7 - len(days_with_sessions)

	# Attempt to persist computed metrics back to sessions table in a 'metadata' column
	metrics = {
		"pr_by_exercise": pr_by_exercise,
		"avg_intensity": avg_intensity,
		"missed_days_last_7": missed_days_last_7,
	}
	if session_id is not None:
		try:
			_rest_patch("sessions", session_id, {"metadata": metrics}, user_token=user_token)
		except Exception:
			# Not fatal if DB doesn't accept extra column
			pass

	# Build recommendations for each exercise
	recommendations: Dict[str, Any] = {}
	for ex in exercises:
		try:
			r = _rest_get("sets", select="*", eq={"exercise": ex, "user_id": user_id}, order=("id", "desc"), limit=5, user_token=user_token)
		except Exception:
			continue

		sets_data = r if isinstance(r, list) else None
		if sets_data:
			rule_rec = calculate_dynamic_recommendation(sets_data)
			ai_rec = calculate_ai_recommendation(sets_data, exercise=ex, last_n=5, target_reps=10)
			recommendations[ex] = {"rule": rule_rec, "ai": ai_rec}

	return {
		"session_id": session_id,
		"date": session_date.isoformat(),
		"calories": payload.calories,
		"inserted_sets": inserted_sets,
		"pr_by_exercise": pr_by_exercise,
		"avg_intensity": avg_intensity,
		"missed_days_last_7": missed_days_last_7,
		"recommendations": recommendations,
	}


def calculate_dynamic_recommendation(sets: List[Dict[str, Any]], target_reps: int = 10) -> Dict[str, Any]:
	"""
	Calculate a simple dynamic recommendation based on recent sets.

	Args:
		sets: List of set dictionaries. Each dictionary should contain at
			least the keys: 'weight' (float), 'reps' (int) and 'intensity' (int).
			The list is expected to be ordered with the most recent set first
			(descending by id).

	Returns:
		Tuple of (recommended_weight, recommended_reps).

	Logic summary:
	- Use the most recent set as the base weight.
	- If last intensity < 8: +2.5% weight.
	- If last intensity >= 9 and reps < target_reps: keep weight the same.
	- If last set was a failure (reps < 50% of target): -5% weight.
	- If average reps over the window is increasing, apply a small boost.

	This helper implements the core logic; endpoint may apply additional
	adjustments based on user-provided feedback.
	"""

	if not sets:
		raise ValueError("`sets` must contain at least one set dict")

	# Parameters / constants
	recent = sets[0]

	# Defensive extraction with sensible defaults
	base_weight = float(recent.get("weight", 0.0))
	last_reps = int(recent.get("reps", 0))
	last_intensity = int(recent.get("intensity", 0))

	recommended_weight = base_weight
	recommended_reps = target_reps

	# 1) Intensity-based adjustments
	if last_intensity < 8:
		# last set felt easy -> small progressive increase
		recommended_weight *= 1.025
	elif last_intensity >= 9 and last_reps < target_reps:
		# very hard but couldn't hit target -> hold weight steady
		recommended_weight = base_weight

	# 2) Failure handling (very low reps relative to target)
	if last_reps < 0.5 * target_reps:
		# likely a failure: reduce load to allow recovery/form work
		recommended_weight *= 0.95
		# recommend fewer reps to rebuild confidence
		recommended_reps = max(1, int(last_reps * 0.8))
	else:
		# If the user is close to or above target, try nudging reps toward target
		if last_reps < target_reps:
			recommended_reps = min(target_reps, last_reps + 1)
		else:
			recommended_reps = target_reps

	# 3) Trend-based adjustment: compare first half vs second half average reps
	# Convert list into chronological order (oldest -> newest) for trend check
	chronological = list(reversed(sets)) if len(sets) > 1 else sets[:]
	reps_list = [int(s.get("reps", 0)) for s in chronological]

	if len(reps_list) >= 2:
		mid = len(reps_list) // 2
		first_half_avg = sum(reps_list[:mid]) / max(1, len(reps_list[:mid]))
		second_half_avg = sum(reps_list[mid:]) / max(1, len(reps_list[mid:]))
		if second_half_avg > first_half_avg:
			# user is improving reps over the window -> small extra increase
			recommended_weight *= 1.01

	# Final safety: don't recommend negative or NaN weights
	if recommended_weight <= 0 or not isinstance(recommended_weight, float):
		recommended_weight = base_weight

	note_parts: List[str] = []
	# add short notes to explain the suggestion
	if last_intensity < 8:
		note_parts.append("Last set felt easy: small increase suggested.")
	if last_intensity >= 9 and last_reps < target_reps:
		note_parts.append("Last set was very hard but target not met: hold weight.")
	if last_reps < 0.5 * target_reps:
		note_parts.append("Recent failure detected: reduce weight and focus on form.")

	# Return a structured dict so callers (and frontend) can consume easily
	# Round recommended weight to practical plate increments
	rec_weight_rounded = _round_to_plate(recommended_weight)

	return {
		"recommended_weight": rec_weight_rounded,
		"recommended_reps": int(round(recommended_reps)),
		"note": " ".join(note_parts),
	}


def _linear_regression_predict(x: List[float], y: List[float], predict_x: float) -> Optional[float]:
	"""
	Simple least-squares linear regression (no external libs).
	Returns predicted y at predict_x. Returns None if not enough data.
	"""
	if len(x) < 2 or len(y) < 2 or len(x) != len(y):
		return None
	n = len(x)
	mean_x = sum(x) / n
	mean_y = sum(y) / n
	num = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y))
	den = sum((xi - mean_x) ** 2 for xi in x)
	if den == 0:
		return None
	slope = num / den
	intercept = mean_y - slope * mean_x
	return intercept + slope * predict_x


def _pearson_corr(x: List[float], y: List[float]) -> Optional[float]:
	"""
	Compute Pearson correlation coefficient between x and y without external libs.
	"""
	if len(x) < 2 or len(y) < 2 or len(x) != len(y):
		return None
	n = len(x)
	mean_x = sum(x) / n
	mean_y = sum(y) / n
	num = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y))
	den_x = sum((xi - mean_x) ** 2 for xi in x)
	den_y = sum((yi - mean_y) ** 2 for yi in y)
	den = (den_x * den_y) ** 0.5
	if den == 0:
		return 0.0
	return num / den


def _round_to_plate(weight: float) -> float:
	"""
	Round a weight to realistic gym plate increments.
	Current policy: round to the nearest 0.5 kg (half-kilogram increments).
	Examples: 12.23 -> 12.0, 12.37 -> 12.5
	"""
	try:
		w = float(weight)
	except Exception:
		return float(weight or 0.0)

	# Round to nearest 0.5 kg
	rounded = round(w * 2.0) / 2.0
	# Avoid negative zero or weird floats
	return float(round(rounded, 2))


# --- Extended helpers for improved recommendations ---
def _get_recent_sets(exercise: str, user_id: str, last_n: int = 50) -> List[Dict[str, Any]]:
	"""Fetch recent sets for an exercise with a safe upper limit.
	Default window extended (50) for better trend detection; callers can request fewer.
	"""
	try:
		r = _rest_get("sets", select="*", eq={"exercise": exercise, "user_id": user_id}, order=("id", "desc"), limit=last_n)
		return r if isinstance(r, list) else []
	except Exception:
		return []


def _holt_linear_predict(series: List[float], alpha: float = 0.3, beta: float = 0.1, steps: int = 1) -> Optional[float]:
	"""Simple Holt's linear method (double exponential smoothing) to predict next value(s).
	Returns forecast for predict_steps ahead; returns None if insufficient data.
	Implemented lightweight (no seasonal component).
	"""
	if not series or len(series) < 2:
		return None
	s = float(series[0])
	b = float(series[1] - series[0])
	for t in range(1, len(series)):
		x = float(series[t])
		last_s = s
		s = alpha * x + (1 - alpha) * (s + b)
		b = beta * (s - last_s) + (1 - beta) * b
	# forecast steps ahead
	return float(s + b * steps)


# Mapping of exercises to simple substitutions (conservative suggestions)
SUBSTITUTIONS: Dict[str, List[str]] = {
	'Incline Dumbbell Press': ['Smith Machine Press', 'Push-ups (weighted)'],
	'Smith Machine Squat': ['Goblet Squat', 'Leg Press'],
	'Romanian Deadlift': ['Dumbbell Romanian Deadlift', 'Kettlebell Swing'],
	'Overhead Press': ['Seated Dumbbell Press', 'Landmine Press'],
	'Lat Pulldown': ['Pull-ups (assisted)', 'Seated Cable Row'],
}


def _get_substitutions(exercise: str) -> List[str]:
	return SUBSTITUTIONS.get(exercise, [])


def _compute_weekly_volume(exercise: str, user_id: str, days: int = 7) -> float:
	"""Compute total volume for an exercise over the last `days` days (weight * reps sum)."""
	try:
		# fetch more rows and filter by session dates
		sets = _get_recent_sets(exercise, user_id, last_n=200)
	except Exception:
		return 0.0
	total = 0.0
	cutoff = (datetime.utcnow() - timedelta(days=days)).date()
	for s in sets:
		sid = s.get('session_id')
		if sid is None:
			continue
		try:
			sess = _rest_get('sessions', select='date', eq={'id': sid}, limit=1)
			sessdata = sess if isinstance(sess, list) else None
			if sessdata and len(sessdata) > 0:
				dstr = sessdata[0].get('date')
				try:
					d = datetime.fromisoformat(dstr).date()
					if d >= cutoff:
						w = float(s.get('weight') or 0)
						r = int(s.get('reps') or 0)
						total += w * r
				except Exception:
					continue
		except Exception:
			continue
	return float(total)


def calculate_ai_recommendation(
	sets: List[Dict[str, Any]],
	exercise: str,
	user_id: str,
	last_n: int = 10,
	target_reps: int = 10,
) -> Dict[str, Any]:
	"""
	Lightweight AI-style recommendation using historical trends and heuristics.

	- Uses simple linear regression on weight and reps trends.
	- Detects fatigue from skipped sessions, high recent intensity, and low calories.
	- Computes correlations between calories and performance; if strong
	  positive correlation exists, reduces recommendation when calories low.

	Returns a dict with keys:
	- ai_weight, ai_reps, ai_note, fatigue_adjusted (bool), fatigue_score (0-1)
	"""
	# Defensive
	if not sets:
		return {"ai_weight": None, "ai_reps": None, "ai_note": "no data", "fatigue_adjusted": False, "fatigue_score": 0.0}

	# Prepare chronological data: oldest -> newest
	chronological = list(reversed(sets))

	# Build series of indices, weights, reps, intensities
	xs = list(range(len(chronological)))
	weights = [float(s.get("weight") or 0.0) for s in chronological]
	reps = [int(s.get("reps") or 0) for s in chronological]
	intensities = [int(s.get("intensity") or 0) for s in chronological]

	# Performance metric: volume = weight * reps (per set)
	volumes = [w * r for w, r in zip(weights, reps)]

	# 1) Trend prediction: use a blend of Holt (double exponential smoothing)
	# and simple linear regression for robustness. Prefer Holt for non-linear
	# plateau handling but fall back to regression when appropriate.
	predict_x = len(xs)  # next index
	holt_pred = _holt_linear_predict(weights, alpha=0.25, beta=0.05, steps=1)
	lr_pred = _linear_regression_predict(xs, weights, predict_x)
	# Blend: prefer holt if it produced a sensible value, else LR, else last observed
	if holt_pred is not None:
		weight_pred = holt_pred
	elif lr_pred is not None:
		weight_pred = lr_pred
	else:
		weight_pred = None

	reps_pred = _linear_regression_predict(xs, reps, predict_x)

	# Fallbacks: if prediction fails, use last observed
	last_weight = weights[-1]
	last_reps = reps[-1]
	if weight_pred is None:
		weight_pred = last_weight
	if reps_pred is None:
		reps_pred = last_reps

	# Limit predicted jump to a safe percentage (no more than +5% increase)
	max_increase = 1.05
	min_decrease = 0.90
	# apply caps
	weight_pred = max(last_weight * min_decrease, min(last_weight * max_increase, weight_pred))
	reps_pred = max(1, min(target_reps + 2, int(round(reps_pred))))

	# 2) Fatigue detection: richer metric using intensity, gaps between sessions,
	# recent volume drop and calories.
	recent_window = chronological[-min(len(chronological), 6):]
	recent_intensity_avg = sum(int(s.get("intensity", 0)) for s in recent_window) / max(1, len(recent_window))

	# Skipped sessions detection: check gaps between session dates if available
	session_dates = []
	for s in chronological:
		sid = s.get("session_id")
		if sid is None:
			continue
		try:
			sess = _rest_get("sessions", select="date,calories", eq={"id": sid}, limit=1)
			sessdata = sess if isinstance(sess, list) else None
			if sessdata and len(sessdata) > 0:
				dstr = sessdata[0].get("date")
				cal = sessdata[0].get("calories")
				try:
					d = datetime.fromisoformat(dstr).date()
					session_dates.append((d, cal))
				except Exception:
					continue
		except Exception:
			continue

	# Count missed days in the last 7 days and compute days since last session
	missed_days = 0
	calories_recent = []
	days_since_last = None
	if session_dates:
		dates_only = [d for d, c in session_dates]
		dates_only_sorted = sorted(dates_only)
		today = datetime.utcnow().date()
		days = set(dates_only)
		for i in range(0, 7):
			day = today - timedelta(days=i)
			if day not in days:
				missed_days += 1
		# days since last session
		try:
			days_since_last = (today - dates_only_sorted[-1]).days
		except Exception:
			days_since_last = None
		# collect calories
		calories_recent = [c for _, c in session_dates if c is not None]

	avg_calories = sum(calories_recent) / max(1, len(calories_recent)) if calories_recent else None

	# Volume drop detection: compare average volume of recent 3 sessions vs previous 3
	session_volumes = {}
	for s, vol in zip(chronological, volumes):
		sid = s.get("session_id")
		if sid is None:
			continue
		session_volumes.setdefault(sid, []).append(vol)
	sess_ids = list(session_volumes.keys())
	sess_avg_vol = [sum(session_volumes[sid]) / len(session_volumes[sid]) for sid in sess_ids]
	vol_drop = 0.0
	if len(sess_avg_vol) >= 6:
		recent_avg = sum(sess_avg_vol[-3:]) / 3.0
		prev_avg = sum(sess_avg_vol[-6:-3]) / 3.0
		if prev_avg > 0:
			vol_drop = max(0.0, (prev_avg - recent_avg) / prev_avg)

	# Fatigue score: combine missed days (0..1), recent intensity, days_since_last (recovery), and volume drop
	fatigue_score = 0.0
	fatigue_score += min(1.0, missed_days / 7.0) * 0.30
	fatigue_score += min(1.0, max(0.0, (recent_intensity_avg - 6) / 4.0)) * 0.30
	if days_since_last is not None:
		# more days since last -> better recovery (so invert): if 0 days since last (same-day), raise fatigue
		rec_factor = min(7, days_since_last) / 7.0
		fatigue_score += (1.0 - rec_factor) * 0.2
	if avg_calories is not None:
		deficit = max(0.0, (2500 - avg_calories) / 1000.0)
		fatigue_score += min(1.0, deficit) * 0.1
	# volume drop adds to fatigue
	fatigue_score += min(1.0, vol_drop) * 0.1
	fatigue_score = min(1.0, fatigue_score)
	fatigue_adjusted = False

	ai_weight = float(round(weight_pred, 2))
	ai_reps = int(reps_pred)
	ai_note_parts: List[str] = []

	if fatigue_score > 0.45:
		# reduce weight to allow recovery (conservative)
		ai_weight *= max(0.85, 1.0 - fatigue_score * 0.12)
		fatigue_adjusted = True
		ai_note_parts.append(f"Fatigue predicted (score {fatigue_score:.2f}); reducing load.")

	# 3) Correlation: calories vs volume
	# Build per-session average volume and calories lists
	session_volumes = {}
	for s, vol in zip(chronological, volumes):
		sid = s.get("session_id")
		if sid is None:
			continue
		session_volumes.setdefault(sid, []).append(vol)
	sess_ids = list(session_volumes.keys())
	sess_avg_vol = [sum(session_volumes[sid]) / len(session_volumes[sid]) for sid in sess_ids]
	sess_cals = []
	for sid in sess_ids:
		try:
			sess = _rest_get("sessions", select="calories", eq={"id": sid}, limit=1)
			sdata = sess if isinstance(sess, list) else None
			if sdata and len(sdata) > 0:
				sess_cals.append(float(sdata[0].get("calories") or 0))
			else:
				sess_cals.append(0.0)
		except Exception:
			sess_cals.append(0.0)

	corr = None
	if len(sess_avg_vol) >= 2 and len(sess_cals) == len(sess_avg_vol):
		corr = _pearson_corr(sess_cals, sess_avg_vol)

	if corr is not None and corr > 0.3 and avg_calories is not None and avg_calories < 2200:
		# performance seems correlated with calories and recent calories are low -> be conservative
		ai_weight *= 0.97
		ai_note_parts.append("Low calories correlated with lower performance; modest reduction applied.")

	# Final safety clamps
	if ai_weight is None or ai_weight <= 0 or not isinstance(ai_weight, float):
		ai_weight = last_weight

	# Decide on dynamic sets recommendation (conservative):
	# - If last set felt easy and fatigue low -> consider +1 set (up to +2)
	# - If fatigue high -> reduce sets by 1
	last_sets_count = 3
	try:
		# If caller provided sets metadata, try to infer; otherwise use default 3
		last_sets_count = max(1, min(8, len([s for s in chronological if s])))
	except Exception:
		last_sets_count = 3

	recommended_sets = last_sets_count
	if recent_intensity_avg < 6 and fatigue_score < 0.25:
		recommended_sets = min(8, last_sets_count + 1)
	if fatigue_score > 0.6:
		recommended_sets = max(1, last_sets_count - 1)

	# Small personalization: adjust aggressiveness based on how fast PR has changed
	pr_slope = None
	try:
		# estimate PR progression slope from last 6 PR observations
		pr_rows = _rest_get('sets', select='weight,exercise', eq={'exercise': exercise, 'user_id': user_id}, order=('id', 'desc'), limit=12)
		pr_weights = [float(r.get('weight') or 0) for r in (pr_rows if isinstance(pr_rows, list) else [])]
		if len(pr_weights) >= 3:
			# slope between earliest and latest / count
			pr_slope = (pr_weights[0] - pr_weights[-1]) / max(1, len(pr_weights))
	except Exception:
		pr_slope = None

	# If the user is progressing faster than typical, be slightly more aggressive (small factor)
	personal_aggression = 1.0
	if pr_slope is not None and pr_slope > 0.01:
		personal_aggression = 1.02
	elif pr_slope is not None and pr_slope < -0.02:
		personal_aggression = 0.98

	ai_weight = _round_to_plate(ai_weight * personal_aggression)

	# Suggest substitutions conservatively
	subs = _get_substitutions(exercise)

	return {
		"ai_weight": float(ai_weight),
		"ai_reps": int(ai_reps),
		"ai_note": " ".join(ai_note_parts) if ai_note_parts else "Trend-based AI suggestion",
		"fatigue_adjusted": bool(fatigue_adjusted),
		"fatigue_score": round(float(fatigue_score), 3),
		"calories_correlation": round(float(corr), 3) if corr is not None else None,
		"recommended_sets": int(recommended_sets),
		"substitutions": subs,
	}


@app.get("/user/profile")
def get_user_profile(user_id: str = Depends(get_current_user_id)) -> Dict[str, Any]:
	"""Get user profile with current and ideal stats."""
	try:
		r = _rest_get("user_profiles", select="*", eq={"user_id": user_id}, limit=1)
		if isinstance(r, list) and len(r) > 0:
			return r[0]
		# Return defaults if no profile exists
		return {
			"user_id": user_id,
			"current_weight_kg": 70,
			"height_cm": 175,
			"ideal_weight_kg": 85,
			"age": 25,
			"sex": "male",
			"theme_color": "#ff2f54"
		}
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {e}")


@app.put("/user/profile")
def update_user_profile(profile: Dict[str, Any], user_id: str = Depends(get_current_user_id)) -> Dict[str, Any]:
	"""Update user profile."""
	try:
		# Check if profile exists
		existing = _rest_get("user_profiles", select="id", eq={"user_id": user_id}, limit=1)
		
		profile_data = {
			"user_id": user_id,
			"current_weight_kg": profile.get("current_weight_kg", 70),
			"height_cm": profile.get("height_cm", 175),
			"ideal_weight_kg": profile.get("ideal_weight_kg", 85),
			"age": profile.get("age", 25),
			"sex": profile.get("sex", "male"),
			"theme_color": profile.get("theme_color", "#ff2f54")
		}
		
		if isinstance(existing, list) and len(existing) > 0:
			# Update existing
			profile_id = existing[0]["id"]
			r = _rest_patch("user_profiles", profile_id, profile_data)
		else:
			# Create new
			r = _rest_post("user_profiles", profile_data)
		
		if isinstance(r, list) and len(r) > 0:
			return r[0]
		return profile_data
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Failed to update profile: {e}")


@app.get("/recommendation_dynamic")
def recommendation_dynamic(
	exercise: str = Query(..., description="Exercise name to base recommendation on"),
	last_n: int = Query(5, ge=1, le=50, description="Number of last sets to consider"),
	intensity_feedback: int = Query(0, ge=0, le=10, description="Optional RPE-style feedback (0-10)"),
	target_reps: int = Query(10, ge=1, le=50, description="Target reps to guide recommendations"),
	user_id: str = Depends(get_current_user_id),
) -> Dict[str, Any]:
	"""
	Dynamic recommendation endpoint.

	Fetches the last `last_n` sets for `exercise` from Supabase and computes a
	recommended next-set weight and reps using `calculate_dynamic_recommendation`.

	Optional `intensity_feedback` can be provided (0-10) to bias the recommendation
	slightly based on how hard the user felt the set was.
	"""

	# Fetch recent sets for the exercise via PostgREST (extend history by default)
	try:
		data = _get_recent_sets(exercise, user_id, last_n=max(20, last_n))
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Database query failed: {e}")

	if not data:
		raise HTTPException(status_code=404, detail=f"No sets found for exercise '{exercise}'")

	# Ensure we have the expected fields on each set dict; pass to helpers
	try:
		rec = calculate_dynamic_recommendation(data, target_reps=target_reps)
		rec_weight = float(rec["recommended_weight"])
		rec_reps = int(rec["recommended_reps"])
		base_note = rec.get("note", "")
		# AI-enhanced recommendation
		ai_rec = calculate_ai_recommendation(data, exercise=exercise, user_id=user_id, last_n=last_n, target_reps=target_reps)
		ai_weight = ai_rec.get("ai_weight")
		ai_reps = ai_rec.get("ai_reps")
		ais_note = ai_rec.get("ai_note")
		fatigue_adjusted = ai_rec.get("fatigue_adjusted", False)
		recommended_sets = ai_rec.get("recommended_sets")
		substitutions = ai_rec.get("substitutions")
	except ValueError as e:
		raise HTTPException(status_code=400, detail=str(e))
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Recommendation calc failed: {e}")

	note_parts: List[str] = []
	if base_note:
		note_parts.append(base_note)

	# Apply optional intensity_feedback adjustments
	# intensity_feedback is always provided (defaults to 0 meaning not hard)
	if intensity_feedback >= 9:
		# User reported very hard -> be conservative (avoid overshooting).
		rec_weight *= 1.00  # keep same (no increase)
		note_parts.append("High perceived intensity; holding weight steady.")
	elif intensity_feedback >= 7:
		# moderately hard -> small increase allowed
		rec_weight *= 1.01
		note_parts.append("Moderate perceived intensity; small (+1%) increase applied.")
	elif intensity_feedback <= 4 and intensity_feedback > 0:
		# felt easy -> encourage slight increase
		rec_weight *= 1.02
		note_parts.append("Felt easy; small (+2%) increase applied.")
	else:
		note_parts.append("No strong perceived-intensity adjustment applied.")

	# Build a friendly guidance note
	last_set = data[0]
	last_reps = int(last_set.get("reps", 0))
	last_intensity = int(last_set.get("intensity", 0))
	if last_intensity < 8:
		note_parts.append("Last set intensity was < {0} — consider increasing weight slightly.".format(target_reps))
	if last_reps < 0.5 * target_reps:
		note_parts.append("Last set looked like a failure; reduce weight and focus on form.")

	note = " ".join(note_parts) if note_parts else ""

	# Round weight for readability
	recommended_weight_rounded = round(float(rec_weight), 2)

	# Fetch current PR for the exercise (best weight)
	pr_weight = None
	try:
		pr_row = _rest_get("sets", select="weight", eq={"exercise": exercise, "user_id": user_id}, order=("weight", "desc"), limit=1)
		if isinstance(pr_row, list) and len(pr_row) > 0:
			pr_weight = float(pr_row[0].get("weight") or 0.0)
	except Exception:
		pr_weight = None

	pr_pct = None
	if pr_weight and pr_weight > 0:
		try:
			pr_pct = round((recommended_weight_rounded / pr_weight) * 100.0, 1)
		except Exception:
			pr_pct = None

	return {
		"exercise": exercise,
		"recommended_weight": recommended_weight_rounded,
		"recommended_reps": int(rec_reps),
		"note": note,
		"pr_weight": pr_weight,
		"pr_percent_of_recommendation": pr_pct,
		"ai_recommendation": {
			"ai_weight": ai_weight,
			"ai_reps": ai_reps,
			"ai_note": ai_rec.get("ai_note"),
			"calories_correlation": ai_rec.get("calories_correlation"),
			"fatigue_score": ai_rec.get("fatigue_score"),
		},
		"fatigue_adjusted": fatigue_adjusted,
		"recommended_sets": recommended_sets,
		"substitutions": substitutions,
	}


@app.get("/analytics")
def analytics(
	exercise: str = Query(..., description="Exercise name"),
	last_n: int = Query(30, ge=1, le=200),
	user_id: str = Depends(get_current_user_id),
) -> Dict[str, Any]:
	"""
	Return simple progression data for an exercise: recent sets with date, weight, reps, intensity
	and a running PR value. This data is intended for frontend charts.
	"""
	try:
		r = _rest_get("sets", select="*", eq={"exercise": exercise, "user_id": user_id}, order=("id", "desc"), limit=last_n)
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Failed to query sets: {e}")

	data = r if isinstance(r, list) else None
	if not data:
		return {"exercise": exercise, "data": []}

	# Reverse to chronological (oldest first)
	chronological = list(reversed(data))

	output = []
	running_pr = 0.0
	for s in chronological:
		weight = float(s.get("weight", 0) or 0)
		reps = int(s.get("reps", 0) or 0)
		intensity = int(s.get("intensity", 0) or 0)
		session_id = s.get("session_id")
		date_str = None
		calories = None
		if session_id is not None:
			try:
				sess = _rest_get("sessions", select="date,calories", eq={"id": session_id}, limit=1)
				sessdata = sess if isinstance(sess, list) else None
				if sessdata and len(sessdata) > 0:
					date_str = sessdata[0].get("date")
					calories = sessdata[0].get("calories")
			except Exception:
				date_str = None

		running_pr = max(running_pr, weight)
		output.append({"date": date_str, "weight": weight, "reps": reps, "intensity": intensity, "pr": running_pr, "calories": calories})

	return {"exercise": exercise, "data": output}