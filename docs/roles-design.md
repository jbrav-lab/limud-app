# Roles beyond the family: teacher, principal, and roles not yet known

Status: **design only** (owner request, 2026-11-17). Nothing here is built, and the database needs no change today. Part of the [go-live plan](go-live-plan.md); the classroom beta that would need it is §12.12 in the [security file](security-privacy.md).

## What the database already gives
- **Deny by default.** Every table has Row Level Security; a role without policies sees nothing. A new role can't leak by accident, only by a policy written for it.
- **Reserved hooks:** `tests.owner_scope` (only `'family'` allowed now; `'class'` and `'grade'` planned), `children.enrollment` (a check keeps it empty), and the empty `ref_schools` and `ref_grades` lists.
- **Roles are a checked text column** (`family_members.role`, `invites.kind`). Widening the allowed list is a short new migration; stored rows don't change.

What it doesn't give: the access helpers answer "is the caller a parent in this family?". School roles belong to classes and schools, not families, so they get their own membership and policies, never rows in `family_members`.

## Principles
1. **The family owns a child's data.** School staff see a child only after a parent links that child to a class, and the link can be revoked by any parent at any time. Revoking ends access at once.
2. **Least data per role.** A teacher sees class work only (class tests, their results, the mistakes in them), not free practice, streaks or the family. A principal sees totals only.
3. **The same unlinkability as parents.** Staff sign-ins are stored as an HMAC (§9.3 of the security file); names are encrypted; no IP addresses; action times rounded to the hour.
4. **Adding a role is data plus tests, not a rewrite.** Policies ask "does the caller have permission P in scope S?", answered from a permissions table; a new role is new rows, its policies' tests and a short migration.

## Roles

| Role | Scope | Can | Can't | How access starts |
|---|---|---|---|---|
| **Teacher** | One class (or more) | Create class tests (`owner_scope = 'class'`); see results and the mistakes in them for linked children; release results | See free practice, other subjects' progress, the family, other parents | The admin (later: the principal) appoints them. A parent links a child with a **class code** (like device pairing: one-time, expires), and that is recorded as consent |
| **Principal** | One school | See **totals per class and grade** for class tests, only for groups of **at least 5 children** | See any individual child, name or answer | Appointed by the admin |
| **Admin** (exists) | The app | Invite primary users, manage reference lists, appoint staff | Read family data | Owner |
| **Future roles** | Whatever scope they need | Only the permissions granted in `role_permissions` | Anything else (deny by default) | A migration adds the role and its permission rows |

## Tables (a later migration, not now)
- `schools`, `classes` (school, grade, year, encrypted label).
- `staff_members`: HMAC of the sign-in, `scope_type` (`school` / `class`), `scope_id`, `role` (checked text), appointed by, times rounded to the hour.
- `role_permissions`: (`role`, `permission`) rows, for example (`teacher`, `class_tests.create`) or (`principal`, `class_totals.read`).
- `class_links`: child, class, linked by (member id), consent record, `revoked_at`. A link is the only path from staff to a child.
- `class_codes`: HMAC of a one-time code, class, expiry (15 minutes, like device pairing).
- Views for principals that aggregate and suppress groups smaller than 5.

## Tests that must come with it
- The access-control matrix takes its list of roles from one place (`role_permissions`). A test fails if any role in the schema has no row in the matrix tests.
- Cross-scope isolation: teacher A never sees class B; a revoked link hides the child at once; a principal never gets a row below the group minimum.
- The leak test extended: no staff email or sign-in id in any public table.

## Before any of this is built
The classroom beta's preconditions in the security file (§12.12): a full privacy notice, consent from each parent, the school's agreement and any Ministry of Education requirements, and a data-protection impact assessment updated for the class scale.
