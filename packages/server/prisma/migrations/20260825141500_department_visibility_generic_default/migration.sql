-- HR/CFO decision of 25 August 2026 (docs/hr-cfo-open-questions.md, question 2): colleagues see a
-- generic "absent" without the type; department heads and HR see the exact type through the
-- viewer-aware calendar logic. Existing rows move to the new colleague baseline. Deployments where
-- an administrator later re-broadens a type to EXACT are unaffected: this runs once, at upgrade.
UPDATE "AbsenceType" SET "departmentVisibility" = 'GENERIC' WHERE "departmentVisibility" = 'EXACT';
