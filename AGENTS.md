# SubscriptionKiller

## Expo

This project uses Expo SDK 57.

Before writing code involving Expo, React Native, Expo Router, or Expo packages, consult the exact versioned Expo SDK 57 documentation:

https://docs.expo.dev/versions/v57.0.0/

Do not assume APIs or configuration from older Expo versions apply to this project.

## Project Goal

SubscriptionKiller is an Android app designed to help users find subscriptions they forgot they are paying for.

Core product promise:

"Find the subscriptions you forgot you're paying for."

The intended product pipeline is:

Gmail
→ email retrieval
→ subscription detection
→ merchant / price / frequency / date extraction
→ deduplication
→ subscription records
→ KEEP / REVIEW / KILL
→ spending dashboard

## Current Working Functionality

The following functionality has been successfully tested and must be preserved:

- Google Sign-In works.
- Gmail readonly permission works.
- Gmail API message listing works.
- Gmail message detail retrieval works.
- The current Gmail implementation is in `src/app/index.tsx`.
- The current scan retrieves Gmail message ID, subject, sender, and snippet.
- The current scan has successfully retrieved 20 emails in testing.

## Authentication and Gmail

Google authentication uses:

`@react-native-google-signin/google-signin`

Gmail access uses the Google access token as a Bearer token against the Gmail REST API.

The Gmail scope currently used is:

`https://www.googleapis.com/auth/gmail.readonly`

Do not replace the current Google Sign-In architecture unless explicitly requested.

Do not expose, log, hard-code, or reproduce OAuth secrets, access tokens, refresh tokens, or client secrets.

## Development Rules

- Make small, focused changes.
- Do not rewrite working functionality unnecessarily.
- Do not modify unrelated files.
- Preserve existing authentication and Gmail functionality.
- Prefer pure, testable functions for data-processing logic.
- Prefer incremental implementation over large rewrites.
- Explain significant architectural changes before implementing them.
- Test changes after implementation.
- If a requested change could break existing functionality, identify the risk before making the change.
- Never delete existing functionality without explicit approval.

## Subscription Detection

The subscription detection system should eventually identify:

- merchant
- amount
- currency
- billing frequency
- payment date
- subscription status
- confidence
- supporting evidence

The system should handle:

- duplicate emails
- multiple emails from the same merchant
- recurring payments
- trials
- renewals
- different currencies
- uncertain detections

Detection logic should be separated from Gmail authentication and retrieval wherever practical.

## Privacy

Gmail-derived information is sensitive.

- Do not unnecessarily store email content.
- Do not expose email contents in logs.
- Avoid logging access tokens or credentials.
- Retrieve only the Gmail information needed for the current feature.
- Preserve the user's ability to disconnect Gmail and delete application data as the product develops.

## Codex Workflow

Work incrementally.

Before making a significant change:

1. Inspect the existing implementation.
2. Explain what will change.
3. Identify files that will be modified.
4. Make the smallest reasonable change.
5. Test the change.
6. Report what changed and whether the test passed.

Do not make broad architectural changes unless explicitly approved.

When uncertain about product behavior or architecture, ask for clarification rather than guessing.
