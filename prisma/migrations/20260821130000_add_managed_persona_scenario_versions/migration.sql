CREATE TABLE `personas` (
    `id` VARCHAR(160) NOT NULL,
    `origin` ENUM('LEGACY_IMPORT', 'MANAGED') NOT NULL,
    `next_version` INTEGER NOT NULL DEFAULT 1,
    `archived_at` DATETIME(3) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `personas_archived_at_updated_at_idx`(`archived_at`, `updated_at`),
    INDEX `personas_created_by_user_id_idx`(`created_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `persona_versions` (
    `id` CHAR(36) NOT NULL,
    `persona_id` VARCHAR(160) NOT NULL,
    `version` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL,
    `draft_slot` INTEGER NULL,
    `display_name` VARCHAR(160) NOT NULL,
    `buyer_role` VARCHAR(160) NOT NULL,
    `organization_type` VARCHAR(160) NOT NULL,
    `difficulty` ENUM('EASY', 'MEDIUM', 'HARD') NOT NULL,
    `summary` TEXT NOT NULL,
    `product_interests` JSON NOT NULL,
    `purchase_context` TEXT NOT NULL,
    `behavior_traits` JSON NOT NULL,
    `common_objections` JSON NOT NULL,
    `likely_questions` JSON NOT NULL,
    `training_focus` JSON NOT NULL,
    `runtime_config` JSON NOT NULL,
    `content_hash` CHAR(64) NOT NULL,
    `import_key` VARCHAR(255) NULL,
    `published_at` DATETIME(3) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `persona_versions_import_key_key`(`import_key`),
    UNIQUE INDEX `persona_versions_persona_id_version_key`(`persona_id`, `version`),
    UNIQUE INDEX `persona_versions_persona_id_draft_slot_key`(`persona_id`, `draft_slot`),
    INDEX `persona_versions_persona_id_status_version_idx`(`persona_id`, `status`, `version`),
    INDEX `persona_versions_created_by_user_id_idx`(`created_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `scenarios` (
    `id` VARCHAR(160) NOT NULL,
    `origin` ENUM('LEGACY_IMPORT', 'MANAGED') NOT NULL,
    `next_version` INTEGER NOT NULL DEFAULT 1,
    `archived_at` DATETIME(3) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `scenarios_archived_at_updated_at_idx`(`archived_at`, `updated_at`),
    INDEX `scenarios_created_by_user_id_idx`(`created_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `scenario_versions` (
    `id` CHAR(36) NOT NULL,
    `scenario_id` VARCHAR(160) NOT NULL,
    `version` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL,
    `draft_slot` INTEGER NULL,
    `title` VARCHAR(160) NOT NULL,
    `description` TEXT NOT NULL,
    `difficulty` ENUM('EASY', 'MEDIUM', 'HARD') NOT NULL,
    `category` VARCHAR(160) NOT NULL,
    `customer_need` TEXT NOT NULL,
    `priorities` JSON NOT NULL,
    `training_objective` TEXT NOT NULL,
    `tags` JSON NOT NULL,
    `opening_examples` JSON NOT NULL,
    `runtime_config` JSON NOT NULL,
    `content_hash` CHAR(64) NOT NULL,
    `import_key` VARCHAR(255) NULL,
    `published_at` DATETIME(3) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `scenario_versions_import_key_key`(`import_key`),
    UNIQUE INDEX `scenario_versions_scenario_id_version_key`(`scenario_id`, `version`),
    UNIQUE INDEX `scenario_versions_scenario_id_draft_slot_key`(`scenario_id`, `draft_slot`),
    INDEX `scenario_versions_scenario_id_status_version_idx`(`scenario_id`, `status`, `version`),
    INDEX `scenario_versions_created_by_user_id_idx`(`created_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `persona_scenarios` (
    `persona_id` VARCHAR(160) NOT NULL,
    `scenario_id` VARCHAR(160) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `persona_scenarios_persona_id_sort_order_key`(`persona_id`, `sort_order`),
    INDEX `persona_scenarios_scenario_id_idx`(`scenario_id`),
    PRIMARY KEY (`persona_id`, `scenario_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `training_program_items`
    ADD COLUMN `persona_version_id` CHAR(36) NULL,
    ADD COLUMN `scenario_version_id` CHAR(36) NULL,
    ADD INDEX `program_items_persona_version_idx`(`persona_version_id`),
    ADD INDEX `program_items_scenario_version_idx`(`scenario_version_id`);

ALTER TABLE `simulation_sessions`
    ADD COLUMN `persona_version_id` CHAR(36) NULL,
    ADD COLUMN `scenario_version_id` CHAR(36) NULL,
    ADD COLUMN `content_snapshot` JSON NULL,
    ADD INDEX `sim_sessions_persona_version_idx`(`persona_version_id`),
    ADD INDEX `sim_sessions_scenario_version_idx`(`scenario_version_id`);

ALTER TABLE `personas`
    ADD CONSTRAINT `personas_created_by_user_id_fkey`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `persona_versions`
    ADD CONSTRAINT `persona_versions_persona_id_fkey`
    FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `persona_versions_created_by_user_id_fkey`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `scenarios`
    ADD CONSTRAINT `scenarios_created_by_user_id_fkey`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `scenario_versions`
    ADD CONSTRAINT `scenario_versions_scenario_id_fkey`
    FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `scenario_versions_created_by_user_id_fkey`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `persona_scenarios`
    ADD CONSTRAINT `persona_scenarios_persona_id_fkey`
    FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `persona_scenarios_scenario_id_fkey`
    FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `training_program_items`
    ADD CONSTRAINT `program_items_persona_version_fkey`
    FOREIGN KEY (`persona_version_id`) REFERENCES `persona_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `program_items_scenario_version_fkey`
    FOREIGN KEY (`scenario_version_id`) REFERENCES `scenario_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `simulation_sessions`
    ADD CONSTRAINT `sim_sessions_persona_version_fkey`
    FOREIGN KEY (`persona_version_id`) REFERENCES `persona_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `sim_sessions_scenario_version_fkey`
    FOREIGN KEY (`scenario_version_id`) REFERENCES `scenario_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
