const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function main() {
  // --- Permissions ---
  const permissionsData = [
    { name: "read_users", menuName: "Users" },
    { name: "create_users", menuName: "Users" },
    { name: "update_users", menuName: "Users" },
    { name: "delete_users", menuName: "Users" },
    { name: "read_roles", menuName: "Roles" },
    { name: "create_roles", menuName: "Roles" },
    { name: "update_roles", menuName: "Roles" },
    { name: "delete_roles", menuName: "Roles" },
    { name: "read_categories", menuName: "Categories" },
    { name: "create_categories", menuName: "Categories" },
    { name: "update_categories", menuName: "Categories" },
    { name: "delete_categories", menuName: "Categories" },
    { name: "read_brands", menuName: "Brands" },
    { name: "create_brands", menuName: "Brands" },
    { name: "update_brands", menuName: "Brands" },
    { name: "delete_brands", menuName: "Brands" },
    { name: "read_products", menuName: "Products" },
    { name: "create_products", menuName: "Products" },
    { name: "update_products", menuName: "Products" },
    { name: "delete_products", menuName: "Products" },
    { name: "read_orders", menuName: "Orders" },
    { name: "create_orders", menuName: "Orders" },
    { name: "update_orders", menuName: "Orders" },
    { name: "delete_orders", menuName: "Orders" },
    { name: "read_reports", menuName: "Reports" },
    { name: "create_reports", menuName: "Reports" },
    { name: "update_reports", menuName: "Reports" },
    { name: "delete_reports", menuName: "Reports" },
    { name: "read_settings", menuName: "Settings" },
    { name: "create_settings", menuName: "Settings" },
    { name: "update_settings", menuName: "Settings" },
    { name: "delete_settings", menuName: "Settings" },
    { name: "read_logs", menuName: "Logs" },
    { name: "create_logs", menuName: "Logs" },
    { name: "update_logs", menuName: "Logs" },
    { name: "delete_logs", menuName: "Logs" },
    { name: "read_notifications", menuName: "Notifications" },
    { name: "create_notifications", menuName: "Notifications" },
    { name: "update_notifications", menuName: "Notifications" },
    { name: "delete_notifications", menuName: "Notifications" },
    { name: "read_permissions", menuName: "Permissions" },
    { name: "create_permissions", menuName: "Permissions" },
    { name: "update_permissions", menuName: "Permissions" },
    { name: "delete_permissions", menuName: "Permissions" },
    { name: "read_medication_requests", menuName: "Medication Requests" },
    { name: "create_medication_requests", menuName: "Medication Requests" },
    { name: "update_medication_requests", menuName: "Medication Requests" },
    { name: "delete_medication_requests", menuName: "Medication Requests" },
    { name: "create_addresses", menuName: "Addresses" },
    { name: "read_addresses", menuName: "Addresses" },
    { name: "update_addresses", menuName: "Addresses" },
    { name: "delete_addresses", menuName: "Addresses" },
    { name: "read_coupons", menuName: "Coupons" },
    { name: "create_coupons", menuName: "Coupons" },
    { name: "update_coupons", menuName: "Coupons" },
    { name: "delete_coupons", menuName: "Coupons" },
    { name: "read_prescriptions", menuName: "Prescriptions" },
    { name: "create_prescriptions", menuName: "Prescriptions" },
    { name: "update_prescriptions", menuName: "Prescriptions" },
    { name: "delete_prescriptions", menuName: "Prescriptions" },
    { name: "read_payments", menuName: "Payments" },
    { name: "create_payments", menuName: "Payments" },
    { name: "update_payments", menuName: "Payments" },
    { name: "delete_payments", menuName: "Payments" },
    { name: "read_media", menuName: "Media" },
    { name: "create_media", menuName: "Media" },
    { name: "update_media", menuName: "Media" },
    { name: "delete_media", menuName: "Media" },
    { name: "read_blog_posts", menuName: "Blog Posts" },
    { name: "create_blog_posts", menuName: "Blog Posts" },
    { name: "update_blog_posts", menuName: "Blog Posts" },
    { name: "delete_blog_posts", menuName: "Blog Posts" },
    { name: "read_homepage_layout", menuName: "Homepage Layout" },
    { name: "create_homepage_layout", menuName: "Homepage Layout" },
    { name: "update_homepage_layout", menuName: "Homepage Layout" },
    { name: "delete_homepage_layout", menuName: "Homepage Layout" },
    { name: "read_website_settings", menuName: "Website Settings" },
    { name: "update_website_settings", menuName: "Website Settings" },
    { name: "read_seo", menuName: "SEO" },
    { name: "update_seo", menuName: "SEO" },
    { name: "read_navigation", menuName: "Navigation" },
    { name: "create_navigation", menuName: "Navigation" },
    { name: "update_navigation", menuName: "Navigation" },
    { name: "delete_navigation", menuName: "Navigation" },
    { name: "read_integrations", menuName: "Integrations" },
    { name: "update_integrations", menuName: "Integrations" },
    { name: "read_analytics", menuName: "Analytics" },
    { name: "update_analytics", menuName: "Analytics" },
    { name: "read_email_templates", menuName: "Email Templates" },
    { name: "create_email_templates", menuName: "Email Templates" },
    { name: "update_email_templates", menuName: "Email Templates" },
    { name: "delete_email_templates", menuName: "Email Templates" },
    { name: "read_automation_rules", menuName: "Automation Rules" },
    { name: "create_automation_rules", menuName: "Automation Rules" },
    { name: "update_automation_rules", menuName: "Automation Rules" },
    { name: "delete_automation_rules", menuName: "Automation Rules" },
    { name: "read_contact_requests", menuName: "Contact Requests" },
    { name: "create_contact_requests", menuName: "Contact Requests" },
    { name: "update_contact_requests", menuName: "Contact Requests" },
    { name: "delete_contact_requests", menuName: "Contact Requests" },
    { name: "read_about_us", menuName: "About Us" },
    { name: "create_about_us", menuName: "About Us" },
    { name: "update_about_us", menuName: "About Us" },
    { name: "delete_about_us", menuName: "About Us" },
    { name: "read_countries", menuName: "Country" },
    { name: "create_countries", menuName: "Country" },
    { name: "update_countries", menuName: "Country" },
    { name: "delete_countries", menuName: "Country" },
    { name: "read_shipping", menuName: "Shipping" },
    { name: "create_shipping", menuName: "Shipping" },
    { name: "update_shipping", menuName: "Shipping" },
    { name: "delete_shipping", menuName: "Shipping" },
    { name: "read_payment_method", menuName: "Payment Method" },
    { name: "create_payment_method", menuName: "Payment Method" },
    { name: "update_payment_method", menuName: "Payment Method" },
    { name: "delete_payment_method", menuName: "Payment Method" },
   



    
    
    
  ];

  const permissions = [];
  for (const p of permissionsData) {
    const permission = await prisma.permission.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
    permissions.push(permission);
  }

  // --- Roles ---
  const rolesData = ["Admin", "Manager", "User"];
  const roleMap = {};

  for (const roleName of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    roleMap[roleName] = role;

    if (roleName === "Admin") {
      await prisma.role.update({
        where: { id: role.id },
        data: { permissions: { connect: permissions.map((p) => ({ id: p.id })) } },
      });
    }

    if (roleName === "Manager") {
      await prisma.role.update({
        where: { id: role.id },
        data: {
          permissions: {
            connect: permissions
              .filter((p) => p.menuName === "Users" && !p.name.startsWith("delete"))
              .map((p) => ({ id: p.id })),
          },
        },
      });
    }

    if (roleName === "User") {
      await prisma.role.update({
        where: { id: role.id },
        data: {
          permissions: {
            connect: permissions
              .filter((p) => p.name.startsWith("read"))
              .map((p) => ({ id: p.id })),
          },
        },
      });
    }
  }

  // --- Admin User ---
  // const adminUser = await prisma.user.upsert({
  //   where: { email: "admin@evergreen.com" },
  //   update: {},
  //   create: {
  //     firstName: "Admin",
  //     lastName: "User",
  //     email: "admin@evergreen.com",
  //     phoneNumber: "1234567890",
  //     streetAddress: "Head Office",
  //     city: "City",
  //     roleId: roleMap["Admin"].id,
  //   },
  // });

  // const hashedPassword = await bcrypt.hash("Admin@123", 10);

  // await prisma.credential.upsert({
  //   where: { email: "admin@evergreen.com" },
  //   update: {},
  //   create: {
  //     email: "admin@evergreen.com",
  //     password: hashedPassword,
  //     userId: adminUser.id,
  //   },
  // });

  console.log("✅ Seed completed! Admin user: admin@evergreen.com / Admin@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
