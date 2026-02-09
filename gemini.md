# GEMINI.MD: Project Constitution

## 1. Data Schemas

### Input Payload (User Mission)
```json
{
  "user_id": "UUID",
  "goal": "I want to run a marathon under 4 hours",
  "obstacle": "I have weak knees and limited time to train",
  "preferences": {
    "video_length": "short | medium | long",
    "tone": "motivational | educational"
  }
}
```

### Output Payload (Curated Feed)
```json
{
  "mission_id": "UUID",
  "videos": [
    {
      "video_id": "YouTubeID",
      "title": "How to Run Injury-Free",
      "channel_name": "VerifiedRunCoach",
      "human_score": 98,
      "curation_reason": "Addresses 'weak knees' obstacle with specific strengthening exercises.",
      "summary_points": ["Point 1", "Point 2"],
      "verified_status": "verified"
    }
  ]
}
```

## 2. Behavioral Rules
1.  **Human Verification**: Only videos from channels with `status: 'verified'` are recommended.
2.  **No AI/Faceless**: Rigorous filtering against AI-generated voiceovers or stock-footage-only farming channels.
3.  **Goal-Centric**: Every recommended video must explicitly address the User's defined Goal or Obstacle.
4.  **Zero Distraction**: No "related videos" or algorithmic rabbit holes. Only the curated list.


## 3. Architectural Invariants
1. **Data-First Rule**: Schema must be defined before coding tools.
2. **Self-Annealing**: Always analyze stack traces, patch tools, and update architecture SOPs on failure.
3. **Execution Safety**: Use .tmp/ for intermediate files.
4. **Determinism**: Tools must be atomic and testable.
