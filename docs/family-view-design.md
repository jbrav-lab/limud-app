# Design: Family View (phase 1 of server-side sync)

**Status: design only. Nothing is built or deployed.** Decided with the project owner on 2026-11-15.
The technical sync plan (tables, merge rules, Row Level Security, build order) is [sync-supabase-plan.md](sync-supabase-plan.md). This document sets the **scope and the product rules** for its first phase.

## Scope
- **Users now:** two families (the owner's and the owner's sister's). **Beta (2026-11-17):** three families, all in the owner's own family ([go-live-plan.md](go-live-plan.md) Stage 0b). A classroom beta of up to 6 classes is considered, not decided (security file §12.12).
- **In phase 1:** sign-in, families, server-side sync of every child's activity, parent oversight from a parent's own phone, and parent-made tests.
- **Not in phase 1:** schools, classes, teachers, and any anonymous comparison between children. These are parked under [Future: class rollout](#future-class-rollout-opt-in-with-school-approval). Phase 1 only prepares the data for them.
- **Hosting:** the owner's existing Supabase free-tier project is enough.

## Roles
| Role | Who | Can |
|---|---|---|
| **Admin** | The project owner | Invite primary users. Manage the reference lists. Has **no** access to any family's data unless they are a parent in that family. |
| **Primary user** | Invited by the admin | Create a family, invite parents, remove or change the status of another parent, hand over the primary role. |
| **Parent** | Invited into a family by its primary user | Everything about the family's children: progress, tests, settings. |
| **Child** | A profile inside a family | Practise and take tests. No email and no account: a child's phone joins the family with a one-time code or QR code from a parent. |

- **No gender data, ever.** The app never asks for or stores a parent's or child's gender, and never uses gendered role names (no "Mom/Dad", "אמא/אבא"). The text uses neutral wording, such as **"מחכה לבדיקת מבוגר"** (waiting for an adult's review) and **"הורה"** (parent).
- A family always has **at least one parent**. The last parent can't leave or be removed. The primary role can be handed over, but not dropped.

## Deleting a child
- With **one parent**, that parent can delete a child.
- With **more than one parent**, every parent must approve. One parent requests, the others get an in-app request, and it expires after 7 days if not approved.
- **Removing a parent waits 7 days.** The parent being removed is notified, and no child can be deleted during that time. This closes the loophole of removing the other parent first and then deleting alone.
- **Deletion is soft, then final.** A deleted child is hidden at once, any parent can restore it **until the nightly cleanup two days later** (at least about 46½ hours), and then it is erased. A deletion request (in the app or verified from outside) completes within 48 hours of the end of the day (Israel time) the request was confirmed.
- All of these rules are enforced **on the server** (database functions and Row Level Security), not only in the app.

## Sync and oversight
- The child's phone stays the main copy and works offline. Everything the app records today is synced: stars, streak, topic progress, test results, mistakes and the profile. Merge rules: [sync-supabase-plan.md §4](sync-supabase-plan.md).
- A parent's phone shows the parent area from the server: each child's progress, weak topics, recent mistakes, and every test with its full review.
- **Notifications:** shown **inside the app** on the parent's phone (a badge and a list of unseen results). No push notifications in phase 1.

## Parent-made tests
### Creating
- A parent creates one or **several tests at once** and assigns each to one or more children.
- **Children in the same grade** get the **same test** by default. Opt-in: "customize for this child" makes a separate copy for that child.
- **"From mistakes"** tests are always **personal**: each child gets a test built from their own recent mistakes, even when the children are in the same grade.
- **Children in different grades** always get separate tests, because the content differs.
- **Questions are generated once and frozen** when the test is created. The parent can preview them, siblings and retakes get the same questions, and the test can be taken offline after the next sync.

### Content
- **Default:** balanced difficulty (about 30% level 1, 40% level 2, 30% level 3), spread evenly over the chosen topics.
- **Optional "upcoming school test":** the parent can fill in the date, tick the topics the teacher announced, and add a short note ("pages 40–55"). When it's filled in, the default test draws from those topics. It is never required.
- **Opt-in "choose questions":** the parent can set each question's level, replace a generated question, or pick specific items from the science, Hebrew and English question banks.

### Taking and releasing
1. The child answers. **Answers are saved on the device at once**, so nothing is lost offline, and uploaded at the next sync. **The server scores them**: the child's device downloads a test's questions but never its answer key (decided 2026-11-15, see [security-privacy.md §12](security-privacy.md#12-decisions-2026-11-15)).
2. The child sees **"נשלח ✓ – מחכה לבדיקת מבוגר"**. The score, the answer key and the explanations are **hidden**.
3. A parent reviews the scored test with the answer key. They can:
   - **override any answer**, marking it right or wrong by hand. The score is recalculated, and the record keeps both the app's mark and the override;
   - add a short note.
4. The parent **releases** the results. Only then does the child see the score, the answer key, the explanations and the note.
5. **Opt-in, per test:** "show results immediately" skips the review step.

**Stars and progress** from the test are calculated by the server at scoring time, sent to the child on release, and recalculated if a parent overrides an answer.

## Names and privacy
- **Family names and children's names are encrypted at rest on the server** (column encryption with a key held server-side, for example in Supabase Vault). Other data, such as progress and scores, sits in plain database rows protected by Row Level Security.
- Names are not hashed: a hash can't be turned back into a name, and parents need to see names. Hashing would only be used if the app ever has to *search* by a name, and that isn't planned.
- **Before a wider rollout,** consider moving name encryption onto the devices (a family key that the server never sees). Then even the admin couldn't read names.
- Parents' **email addresses** stay in Supabase's sign-in system, unencrypted, because sign-in needs them.
- **Sign-in page:**
  - Google only (decided 2026-11-16: no email provider, no magic links);
  - no list of families or children anywhere before sign-in;
  - error messages don't reveal whether an email has an account.
- **Device screens:** the "who's learning today?" picker shows only the children of the family that phone belongs to.
- **Consent:** at sign-up, a parent agrees to a short privacy note (what is stored, where, who can see it, how to delete everything). "Delete our family" erases the family and all its data from the server.

## Parent PIN (per parent)
Each parent sets **their own** PIN for their own account. There is no shared, family or master PIN, and the admin can neither set, read nor reset anyone's PIN. The PIN only re-unlocks the parent area on a device where that parent is already signed in; real access is always the parent's own sign-in, and a forgotten PIN means signing in again. Details: [security-privacy.md §8](security-privacy.md#8-authentication-and-the-parent-pin).

## Deletion and other requests when emails can't be linked to children
The live system can resolve a family only for a requester who proves they own the email (by signing in with Google with that address), and never shows the mapping to anyone. Procedures for every case, including a lost email address and a guardian who isn't in the app: [security-privacy.md §10](security-privacy.md#10-data-subject-rights-including-deletion-when-emails-cant-be-linked-to-children).

## Requirement: a database leak must not link an email to a child
Decided 2026-11-15. A dump of the database must not reveal which parent's email address belongs to which family or child.

1. **No sign-in id next to family data.** `family_members` stores an HMAC of the parent's sign-in id (`auth.uid()`), not the id itself. The HMAC key is a **Supabase Vault** secret, and Vault's master key is kept outside the database, so a dump can't be matched back to users. A security-definer function computes the HMAC at request time, and Row Level Security uses it to find "my families".
2. **Family-only parent ids.** Each membership has a random `member_id`. Every recorded parent action uses it, never the sign-in id: reviewed, released, answer override, deletion request and approval, parent removal.
3. **Invites:** only an HMAC of the lower-cased email is stored, with the same key, and the invite row is deleted when it's accepted or expires.
4. **No other identifiers:** no IP addresses or browser/device details in the data tables. Device labels are encrypted like names.
5. **Parent action times are rounded** (to the hour) so they can't be matched to `auth.users.last_sign_in_at`. Children's activity keeps exact times.
6. **Admin screens** can list emails (for invites) and families (names encrypted), but have no way to connect them.
7. **Leak test** on the local stack, run before every deploy: dump the database without the Vault key, then check that no public column contains an `auth.users` id, that no invite traces remain after acceptance, and that no query can join an email to a child.

**Not covered:** someone holding both the dump and the key (control of the server or the Supabase account); guessing from outside knowledge while there are very few families; Supabase request logs and email-service logs, which are outside the database.

## Prepared now, for later (no UI in phase 1)
| In the data now | Makes this possible later |
|---|---|
| Stable ids, timestamps and per-device counters (data version 3) | Any new device or role syncs without a data migration |
| A roles table (admin, primary, parent) | Adding *teacher* and *principal* is one more role |
| Optional, empty **enrollment** per child: school, grade, class, school year | Joining a class is filling in a record |
| A **consent** record per family for sharing anonymous results, **off** by default | Sharing is opt-in and never retroactive |
| Tests have an **owner scope** ("family" now) | A teacher's grade test is the same object with another scope |
| Admin-only reference lists for schools and grades (empty for now) | Parents can only pick schools and grades the admin added |

## Future: class rollout (opt-in, with school approval)
Only if a class shows interest, and only with the teacher's and principal's approval. Each family opts in.
- **Groups:** school → grade → class, from the admin's reference lists. Each child is enrolled per school year.
- **Anonymous group results:** families see only totals (average, number of pupils, distribution), never other children.
  - **Minimum group size:** no aggregate is shown until at least N children contributed (for example 5 or 10).
  - **Grade level** rather than class level for families. Class-level detail is for teachers, if the school allows.
  - **Nightly** updates and rounded or banded values, so a parent can't work out another child's score from a change.
  - Only **shared tests** (the same frozen test for the whole grade, for example published by a teacher) and topic mastery are compared. Free practice is never compared.
- A family sees aggregates only for the grades its own children are in.
- **Teacher role:** a natural first teacher feature is publishing "test material" for the class, filling the "upcoming school test" card for every family in it.
