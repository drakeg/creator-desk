# Versioning and rapid-test policy

Creator Desk follows Semantic Versioning, with release gates enforced through the existing **Desktop releases** GitHub Actions workflow.

| Change | Version example | Release rule |
| --- | --- | --- |
| Patch | 0.14.0 → 0.14.1 | Bug fix, security improvement, test or UI correction without a new significant workflow |
| Minor | 0.14.0 → 0.15.0 | Usable feature slice such as a Comments inbox or improved recommendations; preferred checkpoint for creator testing |
| Major | 0.x → 1.0.0, later 1.x → 2.0.0 | Deliberate stable-product contract or incompatible data/API change, with documented migration and rollback plan |

During the pre-1.0 period, do **not** bump major merely to create another testing opportunity. Major versions communicate compatibility. When 1.0.0 is planned, the stable feature set, database/backup compatibility, upgrade instructions and acceptance tests must be clear.

## Fast test cycle

- Every feature PR gets preview installers for macOS ARM64/Intel, Windows x64 and Linux x64 through GitHub Actions. Successful artifacts are retained for 14 days and are not a formal release.
- Use a patch release for urgent fixes and a minor release each time a coherent creator-facing capability has merged, passed installed-app CI and is ready to test.
- Minor releases need not wait for every story in a sprint; the sprint and issue status remain independent of version numbers.
- Each release must pass all four native build/install/test jobs, publish exact artifacts and checksum manifest, and be verified from the actual release page.
- Never rewrite an already-published tag. A correction gets a new patch number.
- Keep release notes explicit about what is working versus what is still backlog. Do not call paid vidIQ fully replaced until its user-tested acceptance target is met.
- Avoid merging broken CI or bypassing missing credentials by loosening source/ownership checks.
