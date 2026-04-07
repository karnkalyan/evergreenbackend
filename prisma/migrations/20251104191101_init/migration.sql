-- DropIndex
DROP INDEX `CartItem_variantOptionId_fkey` ON `cartitem`;

-- DropIndex
DROP INDEX `Order_couponId_fkey` ON `order`;

-- DropIndex
DROP INDEX `OrderItem_variantOptionId_fkey` ON `orderitem`;

-- AlterTable
ALTER TABLE `category` ADD COLUMN `bannerAlt` VARCHAR(191) NULL,
    ADD COLUMN `imageAlt` VARCHAR(191) NULL,
    ADD COLUMN `logoAlt` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `shippingOptionId` INTEGER NULL;

-- CreateTable
CREATE TABLE `EmailTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmailTemplate_name_idx`(`name`),
    INDEX `EmailTemplate_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationRule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `trigger` ENUM('order_placed', 'order_shipped', 'order_delivered', 'wishlist_reminder', 'user_registered', 'abandoned_cart') NOT NULL,
    `delayHours` INTEGER NOT NULL DEFAULT 0,
    `templateId` INTEGER NOT NULL,
    `status` ENUM('active', 'inactive', 'processing') NOT NULL DEFAULT 'active',
    `conditions` JSON NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AutomationRule_trigger_idx`(`trigger`),
    INDEX `AutomationRule_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QueuedEmail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ruleId` INTEGER NOT NULL,
    `templateId` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `orderId` INTEGER NULL,
    `recipientEmail` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `body` TEXT NOT NULL,
    `variables` JSON NULL,
    `scheduledFor` DATETIME(3) NOT NULL,
    `status` ENUM('pending', 'processing', 'sent', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
    `sentAt` DATETIME(3) NULL,
    `error` VARCHAR(191) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QueuedEmail_scheduledFor_idx`(`scheduledFor`),
    INDEX `QueuedEmail_status_idx`(`status`),
    INDEX `QueuedEmail_ruleId_idx`(`ruleId`),
    INDEX `QueuedEmail_userId_idx`(`userId`),
    INDEX `QueuedEmail_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlogPost` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `author` VARCHAR(100) NOT NULL,
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    `publishDate` DATETIME(3) NULL,
    `featuredImage` VARCHAR(500) NULL,
    `images` JSON NULL,
    `content` TEXT NOT NULL,
    `excerpt` VARCHAR(300) NULL,
    `metaTitle` VARCHAR(150) NULL,
    `metaDescription` TEXT NULL,
    `canonicalUrl` VARCHAR(255) NULL,
    `ogImage` VARCHAR(500) NULL,
    `structuredData` JSON NULL,
    `seoKeywords` TEXT NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `likes` INTEGER NOT NULL DEFAULT 0,
    `shares` INTEGER NOT NULL DEFAULT 0,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BlogPost_slug_key`(`slug`),
    INDEX `BlogPost_slug_idx`(`slug`),
    INDEX `BlogPost_status_idx`(`status`),
    INDEX `BlogPost_publishDate_idx`(`publishDate`),
    INDEX `BlogPost_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CmsPage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `content` TEXT NOT NULL,
    `metaTitle` VARCHAR(150) NULL,
    `metaDescription` TEXT NULL,
    `canonicalUrl` VARCHAR(255) NULL,
    `ogImage` VARCHAR(500) NULL,
    `structuredData` JSON NULL,
    `seoKeywords` TEXT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CmsPage_slug_key`(`slug`),
    INDEX `CmsPage_slug_idx`(`slug`),
    INDEX `CmsPage_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShippingOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(300) NULL,
    `price` DOUBLE NOT NULL DEFAULT 0,
    `freeThreshold` DOUBLE NULL DEFAULT 0,
    `estimatedDays` INTEGER NULL,
    `countries` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShippingOption_name_idx`(`name`),
    INDEX `ShippingOption_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrustBadge` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `icon` VARCHAR(100) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` VARCHAR(300) NULL,
    `color` VARCHAR(50) NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TrustBadge_orderIndex_idx`(`orderIndex`),
    INDEX `TrustBadge_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomepageSection` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('TRUST_BADGES', 'PROMO_BANNER', 'CATEGORY_GRID', 'CATEGORY_CAROUSEL', 'PROMO_CARDS', 'PROMO_GRID', 'FEATURED_PRODUCTS', 'TESTIMONIALS', 'BRAND_CAROUSEL', 'BLOG', 'FAQ', 'VIDEO', 'CALL_TO_ACTION', 'FEATURE_CARDS', 'KEY_METRICS', 'IMAGE_GALLERY', 'GRID') NOT NULL,
    `title` VARCHAR(200) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `config` JSON NULL,
    `parentId` VARCHAR(191) NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HomepageSection_type_idx`(`type`),
    INDEX `HomepageSection_enabled_idx`(`enabled`),
    INDEX `HomepageSection_orderIndex_idx`(`orderIndex`),
    INDEX `HomepageSection_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlogPostCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `blogPostId` INTEGER NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BlogPostCategory_blogPostId_idx`(`blogPostId`),
    INDEX `BlogPostCategory_categoryId_idx`(`categoryId`),
    UNIQUE INDEX `BlogPostCategory_blogPostId_categoryId_key`(`blogPostId`, `categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Credential` ADD CONSTRAINT `Credential_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Credential`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VariantOption` ADD CONSTRAINT `VariantOption_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `ProductVariant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeoAudit` ADD CONSTRAINT `SeoAudit_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SearchKeyword` ADD CONSTRAINT `SearchKeyword_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_shippingOptionId_fkey` FOREIGN KEY (`shippingOptionId`) REFERENCES `ShippingOption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_variantOptionId_fkey` FOREIGN KEY (`variantOptionId`) REFERENCES `VariantOption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderHistory` ADD CONSTRAINT `OrderHistory_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cart` ADD CONSTRAINT `Cart_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `Cart`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_variantOptionId_fkey` FOREIGN KEY (`variantOptionId`) REFERENCES `VariantOption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponUsage` ADD CONSTRAINT `CouponUsage_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponUsage` ADD CONSTRAINT `CouponUsage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponUsage` ADD CONSTRAINT `CouponUsage_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationRule` ADD CONSTRAINT `AutomationRule_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `EmailTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QueuedEmail` ADD CONSTRAINT `QueuedEmail_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `AutomationRule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QueuedEmail` ADD CONSTRAINT `QueuedEmail_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `EmailTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QueuedEmail` ADD CONSTRAINT `QueuedEmail_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QueuedEmail` ADD CONSTRAINT `QueuedEmail_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomepageSection` ADD CONSTRAINT `HomepageSection_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `HomepageSection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlogPostCategory` ADD CONSTRAINT `BlogPostCategory_blogPostId_fkey` FOREIGN KEY (`blogPostId`) REFERENCES `BlogPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlogPostCategory` ADD CONSTRAINT `BlogPostCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PermissionToRole` ADD CONSTRAINT `_PermissionToRole_A_fkey` FOREIGN KEY (`A`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PermissionToRole` ADD CONSTRAINT `_PermissionToRole_B_fkey` FOREIGN KEY (`B`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
