# Security Specification for Noa Assistant Firebase integration

## 1. Data Invariants
- **User configuration (`/users/{userId}`)**: Can only be accessed (read or written) by the user whose authenticated UID matches `userId`. Users must have `email_verified == true`. Direct role or RBAC fields cannot be set by standard users.
- **Black box logs (`/users/{userId}/logs/{logId}`)**: Relational Sync: Only accessible to the user authenticated under `userId`. It is a sub-collection of `/users/{userId}`. Each document must be validly structured (strict keys matching, no shadow keys, validated fields with correct types, size constraints, and server-controlled timestamps).

---

## 2. The "Dirty Dozen" Malicious Payloads (Vulnerability Scenarios)

1. **Payload 1: Identity Spoofing (Create path spoofing)**
   - *Attack*: Authenticated User A (`uid_A`) attempts to write or overwrite User B's `/users/uid_B` configuration.
   - *Expected Action*: Rejected. Access strictly requires `request.auth.uid == userId`.

2. **Payload 2: Shadow Fields Injection on User Config**
   - *Attack*: User attempts to write `/users/uid_A` with custom unrequested fields (e.g., `isAdmin: true` or `role: "admin"`).
   - *Expected Action*: Rejected. Schema validations must enforce precise keys and block unrecognized fields via `keys().hasAll()` size checks.

3. **Payload 3: Unverified Email Access / Email Spoofing**
   - *Attack*: Authenticated User A with `email_verified = false` attempts to write logs or read User Config.
   - *Expected Action*: Rejected. Rules mandate `request.auth.token.email_verified == true`.

4. **Payload 4: Anonymous User Write Event**
   - *Attack*: Anonymous or unauthenticated request attempts to create a log entry in `/users/{userId}/logs/{logId}`.
   - *Expected Action*: Rejected. Standard users must be signed in with a valid account.

5. **Payload 5: Overly Large ID Poisoning**
   - *Attack*: Malicious client attempts to create log document under `/users/uid_A/logs/` with a huge 10KB string ID full of wild characters.
   - *Expected Action*: Rejected. Path keys validation requires `isValidId({logId})`.

6. **Payload 6: Huge String Payload Injection (Denial of Wallet)**
   - *Attack*: malformed `description` key with a 10MB text string.
   - *Expected Action*: Rejected. Validation requires `description.size() <= 2000`.

7. **Payload 7: Invalid Tool Name Enum Spoofing**
   - *Attack*: Malicious client sets `toolName` to a fake tool name like `"HackerTool"` or `"DASHBOARD_DESTROYER"`.
   - *Expected Action*: Rejected. Allowed tools are strictly restricted to Hebrew enums `['יומן', 'כונן', 'משימות', 'כללי']`.

8. **Payload 8: Back-dating Timestamps / Client-Forged Logs**
   - *Attack*: malicious payload sets a far future or historical date manually: `timestamp: "2099-01-01"`.
   - *Expected Action*: Rejected. Timestamps must align with write-time server request data.

9. **Payload 9: Cross-User Log Query Scraping (Query Trust Violation)**
   - *Attack*: Malicious client tries to query all logs in the database or logs of other users without specifying the parent resource `userId`.
   - *Expected Action*: Rejected. Collection list queries must enforce `resource.data` or nested collection rules matching.

10. **Payload 10: Status Bypass in Log Lifecycle**
    - *Attack*: Normal client attempts to update a finished log status from `"נרשם בהצלחה"` or arbitrary fields after terminal state is set.
    - *Expected Action*: Rejected. Status changes locked once terminal state is reached.

11. **Payload 11: Missing Required Fields in Log Creation**
    - *Attack*: Client attempts to write a log containing only `description` but omitting `timestamp` or `syncStatus`.
    - *Expected Action*: Rejected. Mandatory field existence check.

12. **Payload 12: Orphaned Entity Write**
    - *Attack*: Attempting to create a log entry under a user `/users/uid_non_existent` whose profile/config doesn't exist yet.
    - *Expected Action*: Rejected. Creation requires `isOwner()` and existing parent profile validation in transaction.

---

## 3. Test Strategy
We will write rules in `firestore.rules`. Any standard firestore validation checks verify permissions. We will deploy the rules to Firebase so security is fully enforced in the Cloud Firestore cluster.
