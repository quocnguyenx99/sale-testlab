CREATE TABLE `training_programs` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `created_by_user_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `training_programs_status_idx`(`status`),
    INDEX `training_programs_created_by_user_id_idx`(`created_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `training_program_items` (
    `id` CHAR(36) NOT NULL,
    `program_id` CHAR(36) NOT NULL,
    `persona_id` VARCHAR(160) NOT NULL,
    `scenario_id` VARCHAR(160) NOT NULL,
    `mode` ENUM('CUSTOMER_FIRST', 'SALE_FIRST') NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `training_program_items_program_id_sort_order_key`(`program_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `training_programs`
    ADD CONSTRAINT `training_programs_created_by_user_id_fkey`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `training_program_items`
    ADD CONSTRAINT `training_program_items_program_id_fkey`
    FOREIGN KEY (`program_id`) REFERENCES `training_programs`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
