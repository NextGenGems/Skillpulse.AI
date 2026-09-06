import { prisma } from "./prisma";

export async function getOwnerSettings() {
  let settings = await prisma.ownerSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.ownerSettings.create({
      data: {
        id: 1,
        ownerName: "Jake Sumner",
        // When true: pause sales/enroll. Future PromoJobs must no-op while paused too.
        killSwitchPaused: false,
        allowedPurpose: "skill_gap_courses_sales_only",
        maxGenerationJobsPerDay: 1,
        stripeAccountNote: "Jake's connected Stripe only",
      },
    });
  }
  return settings;
}

export async function setKillSwitch(paused: boolean) {
  await getOwnerSettings();
  return prisma.ownerSettings.update({
    where: { id: 1 },
    data: { killSwitchPaused: paused },
  });
}
