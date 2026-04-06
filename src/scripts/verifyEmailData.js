// src/scripts/verifyEmailData.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyEmailData() {
  try {
    console.log('🔍 Verifying email automation data...\n');

    // Get templates
    const templates = await prisma.emailTemplate.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        isSystem: true,
        variables: true
      }
    });

    console.log('📧 Email Templates:');
    templates.forEach(template => {
      console.log(`   - ${template.name} (${template.type}) - ${template.status}`);
    });

    // Get rules
    const rules = await prisma.automationRule.findMany({
      where: { isDeleted: false },
      include: {
        template: {
          select: { name: true }
        }
      },
      orderBy: { priority: 'desc' }
    });

    console.log('\n⚙️ Automation Rules:');
    rules.forEach(rule => {
      console.log(`   - ${rule.name}`);
      console.log(`     Trigger: ${rule.trigger}, Delay: ${rule.delayHours}h`);
      console.log(`     Template: ${rule.template.name}, Status: ${rule.status}`);
    });

    console.log(`\n📊 Summary:`);
    console.log(`   Templates: ${templates.length}`);
    console.log(`   Rules: ${rules.length}`);
    console.log(`   Active Rules: ${rules.filter(r => r.status === 'active').length}`);

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyEmailData();