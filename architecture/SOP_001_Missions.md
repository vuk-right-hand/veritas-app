# SOP 001: User Missions & Curation

## Goal
Allow users to define a "Mission" (Goal + Obstacle) and receive a curated list of "Verified" videos that help them achieve it.

## 1. Data Schemas

### Input: User Mission
```json
{
  "user_id": "UUID",
  "goal": "I want to prevent procrastination",
  "obstacle": "I get distracted by my phone",
  "preferences": {
    "video_length": "short",
    "tone": "scientific"
  }
}
```

### Output: Curated Payload
```json
{
  "mission_id": "UUID",
  "videos": [
    {
      "video_id": "YouTubeID",
      "title": "Dopamine Detox",
      "channel_name": "Andrew Huberman",
      "human_score": 95,
      "curation_reason": "Explains the neuroscience of distraction invoked by your obstacle.",
      "verified_status": "verified"
    }
  ]
}
```

## 2. Invariants & Rules
1.  **Verified Only**: ONLY suggest videos from channels where `status = 'verified'`.
2.  **No Hallucinations**: Video metadata (Title, ID) must exist in the `videos` table.
3.  **Atomic Creation**: A Mission must be saved to `user_missions` BEFORE curations are linked in `mission_curations`.

## 3. Tool Logic: `create_mission.js`
1.  **Validate Input**: Ensure `goal` is present.
2.  **Insert Mission**: Insert into `user_missions` -> Return `mission_id`.
3.  **Find Videos**:
    *   Query `videos` table joined with `channels`.
    *   Filter by `status = 'verified'` AND embedding similarity (if vector search enabled) OR keyword match.
    *   *MVP Logic*: Select random 3 verified videos (placeholder for AI logic).
4.  **Insert Curations**: For each selected video, insert into `mission_curations` with `mission_id`.
5.  **Return Payload**: Fetch full mission + curations and return JSON.

## 4. Error Handling
-   If `user_id` invalid -> 400 Error.
-   If no verified videos found -> Return empty list with "No verified content yet" message.
