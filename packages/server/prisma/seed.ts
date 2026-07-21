import { AppRole, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const schedule = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, start: "09:00", end: "13:00" },
  { weekday, start: "13:30", end: "17:00" },
]);

async function main() {
  const research = await prisma.departmentMirror.upsert({
    where: { sourceId: "ed-dept-research" },
    create: { id: "dept-research", sourceId: "ed-dept-research", name: "Research & Programs", sourceUpdatedAt: new Date() },
    update: { name: "Research & Programs" },
  });
  const finance = await prisma.departmentMirror.upsert({
    where: { sourceId: "ed-dept-finance" },
    create: { id: "dept-finance", sourceId: "ed-dept-finance", name: "Finance & HR", sourceUpdatedAt: new Date() },
    update: { name: "Finance & HR" },
  });

  const employees: Array<{ id: string; sourceId: string; employeeNumber: string; auth0Subject: string; email: string; displayName: string; title: string; departmentId: string; roles: AppRole[] }> = [
    { id: "emp-andrea", sourceId: "ed-1001", employeeNumber: "1001", auth0Subject: "auth0|demo-employee", email: "andrea.caselli@example.org", displayName: "Andrea Caselli", title: "Digital Projects Manager", departmentId: research.id, roles: [] },
    { id: "emp-pre", sourceId: "ed-2001", employeeNumber: "2001", auth0Subject: "auth0|demo-approver", email: "preapprover@example.org", displayName: "Elena Bianchi", title: "Program Manager", departmentId: research.id, roles: [] },
    { id: "emp-resp", sourceId: "ed-2002", employeeNumber: "2002", auth0Subject: "auth0|demo-responsible", email: "responsabile@example.org", displayName: "Marco Rossi", title: "Head of Department", departmentId: research.id, roles: [] },
    { id: "emp-final", sourceId: "ed-3001", employeeNumber: "3001", auth0Subject: "auth0|demo-final", email: "final.approver@example.org", displayName: "Giulia Conti", title: "Finance Director", departmentId: finance.id, roles: ["FERIE_FINAL_APPROVER", "FERIE_PORTAL_ADMIN"] },
    { id: "emp-it", sourceId: "ed-4001", employeeNumber: "4001", auth0Subject: "auth0|demo-it", email: "it@example.org", displayName: "Luca Romano", title: "Systems Administrator", departmentId: research.id, roles: ["STAFF_IT"] },
  ];
  for (const employee of employees) {
    await prisma.employeeMirror.upsert({
      where: { sourceId: employee.sourceId },
      create: { ...employee, roles: [...employee.roles], status: "ACTIVE", fte: 1, schedule, sourceUpdatedAt: new Date() },
      update: { employeeNumber: employee.employeeNumber, auth0Subject: employee.auth0Subject, email: employee.email, displayName: employee.displayName, title: employee.title, departmentId: employee.departmentId, roles: [...employee.roles], schedule, status: "ACTIVE", sourceUpdatedAt: new Date() },
    });
  }

  await prisma.approverAssignment.deleteMany({ where: { employeeId: "emp-andrea" } });
  await prisma.approverAssignment.createMany({ data: [
    { employeeId: "emp-andrea", approverId: "emp-pre", role: "PRE_APPROVER" },
    { employeeId: "emp-andrea", approverId: "emp-resp", role: "RESPONSABILE" },
  ] });

  const accounts = [
    { code: "FERIE", labelIt: "Ferie", labelEn: "Annual leave", unit: "DAYS" as const },
    { code: "EX_FESTIVITA", labelIt: "Ex festività", labelEn: "Former public holidays", unit: "DAYS" as const },
    { code: "PERMESSO", labelIt: "Permessi", labelEn: "Hourly leave", unit: "MINUTES" as const },
  ];
  for (const account of accounts) await prisma.balanceAccount.upsert({ where: { code: account.code }, create: account, update: account });
  const permessoAccount = await prisma.balanceAccount.findUniqueOrThrow({ where: { code: "PERMESSO" } });

  const absenceTypes = [
    { code: "FERIE", labelIt: "Ferie", labelEn: "Annual leave", durationMode: "FULL_DAY_RANGE" as const, entryMode: "SELF_SERVICE" as const, sensitivity: "STANDARD" as const, balanceAccountId: null, requiresApproval: true, departmentVisibility: "EXACT" as const },
    { code: "PERMESSO", labelIt: "Permesso", labelEn: "Hourly leave", durationMode: "MINUTES_SINGLE_DAY" as const, entryMode: "SELF_SERVICE" as const, sensitivity: "STANDARD" as const, balanceAccountId: permessoAccount.id, requiresApproval: true, departmentVisibility: "EXACT" as const },
    { code: "MALATTIA", labelIt: "Malattia", labelEn: "Sick leave", durationMode: "FULL_DAY_RANGE" as const, entryMode: "ADMIN_ONLY" as const, sensitivity: "SENSITIVE" as const, balanceAccountId: null, requiresApproval: false, departmentVisibility: "EXACT" as const },
    { code: "LEGGE_104", labelIt: "Legge 104", labelEn: "Law 104 leave", durationMode: "FULL_DAY_RANGE" as const, entryMode: "ADMIN_ONLY" as const, sensitivity: "SENSITIVE" as const, balanceAccountId: null, requiresApproval: false, departmentVisibility: "EXACT" as const },
    { code: "CONGEDO_PARENTALE", labelIt: "Congedo parentale", labelEn: "Parental leave", durationMode: "FULL_DAY_RANGE" as const, entryMode: "ADMIN_ONLY" as const, sensitivity: "SENSITIVE" as const, balanceAccountId: null, requiresApproval: false, departmentVisibility: "EXACT" as const },
  ];
  for (const type of absenceTypes) await prisma.absenceType.upsert({ where: { code: type.code }, create: type, update: type });

  const holidayRules = [
    ["CAPODANNO", "Capodanno", "New Year's Day", "NATIONAL", "FIXED_ANNUAL", 1, 1, null],
    ["EPIFANIA", "Epifania", "Epiphany", "NATIONAL", "FIXED_ANNUAL", 1, 6, null],
    ["PASQUETTA", "Lunedì dell'Angelo", "Easter Monday", "NATIONAL", "EASTER_OFFSET", null, null, 1],
    ["VENERDI_SANTO", "Chiusura del Venerdì Santo", "Good Friday closure", "CENTRE", "EASTER_OFFSET", null, null, -2],
    ["LIBERAZIONE", "Festa della Liberazione", "Liberation Day", "NATIONAL", "FIXED_ANNUAL", 4, 25, null],
    ["LAVORO", "Festa del Lavoro", "Labour Day", "NATIONAL", "FIXED_ANNUAL", 5, 1, null],
    ["REPUBBLICA", "Festa della Repubblica", "Republic Day", "NATIONAL", "FIXED_ANNUAL", 6, 2, null],
    ["SAN_GIOVANNI", "San Giovanni Battista", "Saint John the Baptist", "LOCAL", "FIXED_ANNUAL", 6, 24, null],
    ["FERRAGOSTO", "Ferragosto", "Assumption Day", "NATIONAL", "FIXED_ANNUAL", 8, 15, null],
    ["SAN_FRANCESCO", "San Francesco d'Assisi", "Saint Francis of Assisi", "NATIONAL", "FIXED_ANNUAL", 10, 4, null],
    ["OGNISSANTI", "Ognissanti", "All Saints' Day", "NATIONAL", "FIXED_ANNUAL", 11, 1, null],
    ["IMMACOLATA", "Immacolata Concezione", "Immaculate Conception", "NATIONAL", "FIXED_ANNUAL", 12, 8, null],
    ["NATALE", "Natale", "Christmas Day", "NATIONAL", "FIXED_ANNUAL", 12, 25, null],
    ["SANTO_STEFANO", "Santo Stefano", "Saint Stephen's Day", "NATIONAL", "FIXED_ANNUAL", 12, 26, null],
  ] as const;
  for (const [code, labelIt, labelEn, kind, recurrence, month, day, easterOffset] of holidayRules) {
    await prisma.holidayRule.upsert({
      where: { code },
      create: { code, labelIt, labelEn, kind, recurrence, month, day, easterOffset, effectiveFrom: code === "SAN_FRANCESCO" ? new Date("2026-01-01T00:00:00Z") : null },
      update: { labelIt, labelEn, kind, recurrence, month, day, easterOffset, effectiveFrom: code === "SAN_FRANCESCO" ? new Date("2026-01-01T00:00:00Z") : null },
    });
  }

  if (await prisma.balanceSnapshot.count({ where: { employeeId: "emp-andrea" } }) === 0) {
    const balances = [{ code: "FERIE", amount: 18 }, { code: "EX_FESTIVITA", amount: 4 }, { code: "PERMESSO", amount: 1_020 }];
    for (const balance of balances) {
      const account = await prisma.balanceAccount.findUniqueOrThrow({ where: { code: balance.code } });
      await prisma.balanceSnapshot.create({ data: { employeeId: "emp-andrea", accountId: account.id, amount: balance.amount, asOf: new Date("2026-06-30T00:00:00Z"), cutoffDate: new Date("2026-06-30T00:00:00Z") } });
    }
  }

  const ferieType = await prisma.absenceType.findUniqueOrThrow({ where: { code: "FERIE" } });
  const ferieAccount = await prisma.balanceAccount.findUniqueOrThrow({ where: { code: "FERIE" } });
  await prisma.absenceRequest.upsert({
    where: { id: "seed-approved-leave" },
    update: {},
    create: {
      id: "seed-approved-leave",
      employeeId: "emp-andrea",
      absenceTypeId: ferieType.id,
      startDate: new Date("2026-11-09T00:00:00Z"),
      endDate: new Date("2026-11-10T00:00:00Z"),
      quantity: 2,
      unit: "DAYS",
      status: "APPROVED",
      provenance: "EXTERNAL_IMPORT",
      reconciliationStatus: "MATCHED",
      employeeSnapshot: { employeeNumber: "1001", displayName: "Andrea Caselli", departmentId: research.id, departmentName: research.name, fte: 1, schedule },
      calculationSnapshot: { sourceName: "Demo opening data", segments: [{ date: "2026-11-09", quantity: 1 }, { date: "2026-11-10", quantity: 1 }], allocations: [{ accountCode: "FERIE", amount: 2 }] },
      submittedAt: new Date("2026-06-30T09:00:00Z"),
      resolvedAt: new Date("2026-06-30T09:00:00Z"),
      segments: { create: [
        { date: new Date("2026-11-09T00:00:00Z"), quantity: 1, unit: "DAYS" },
        { date: new Date("2026-11-10T00:00:00Z"), quantity: 1, unit: "DAYS" },
      ] },
      allocations: { create: { accountId: ferieAccount.id, amount: 2 } },
      decisions: { create: { actorSubject: "seed", actorName: "Opening data import", action: "APPROVE", toStatus: "APPROVED" } },
    },
  });
}

main().finally(() => prisma.$disconnect());
