const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  console.log('🧹 Cleaning and seeding Supabase PostgreSQL database...');

  // Delete all table records in reverse dependency order
  await prisma.attendance.deleteMany();
  await prisma.leave.deleteMany();
  await prisma.employeeProfile.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.clientProfile.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.webMonitor.deleteMany();
  await prisma.automation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  console.log('✅ Cleaned all previous data.');

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: 'Vexor IT Solutions',
      slug: 'vexor-it-solutions',
    },
  });
  console.log('✅ Created Organization:', org.name);

  // Hash password
  const passwordHash = await bcrypt.hash('Abhii@aj005', 10);

  // Create single founder user
  const year = new Date().getFullYear().toString().slice(-2);
  const userId = `VXR${year}001`;

  const founder = await prisma.user.create({
    data: {
      email: 'abhayrana8272@gmail.com',
      passwordHash,
      firstName: 'Abhay',
      lastName: 'Rana',
      role: 'FOUNDER',
      department: 'Executive',
      phone: '+91 75995 44335',
      bio: 'Founder & CEO of Vexor IT Solutions.',
      organizationId: org.id,
      userId,
      employeeNumber: 1,
      isActive: true,
      permissions: JSON.stringify({
        crm: true,
        finance: true,
        hrms: true,
        projects: true,
        monitoring: true,
        ai: true,
      }),
    },
  });

  console.log(`✅ Created Founder Account: [${userId}] ${founder.firstName} ${founder.lastName} (${founder.role}) — ${founder.email}`);
  console.log('\n🎉 Seed complete! Database contains only the primary founder account.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
