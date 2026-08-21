CREATE TABLE `training_assignments` (
    `id` CHAR(36) NOT NULL,
    `program_id` CHAR(36) NOT NULL,
    `assigned_to_user_id` CHAR(36) NOT NULL,
    `assigned_by_user_id` CHAR(36) NOT NULL,
    `due_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `training_assignments_program_id_idx`(`program_id`),
    INDEX `assignments_assignee_created_idx`(`assigned_to_user_id`, `created_at`),
    INDEX `training_assignments_assigned_by_user_id_idx`(`assigned_by_user_id`),
    INDEX `training_assignments_cancelled_at_idx`(`cancelled_at`),
    INDEX `training_assignments_due_at_idx`(`due_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `simulation_sessions`
    ADD COLUMN `training_assignment_id` CHAR(36) NULL,
    ADD COLUMN `training_program_item_id` CHAR(36) NULL,
    ADD INDEX `sim_sessions_assignment_status_idx`(`training_assignment_id`, `status`),
    ADD INDEX `sim_sessions_program_item_idx`(`training_program_item_id`);

ALTER TABLE `training_assignments`
    ADD CONSTRAINT `training_assignments_program_id_fkey`
    FOREIGN KEY (`program_id`) REFERENCES `training_programs`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `training_assignments_assigned_to_user_id_fkey`
    FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `training_assignments_assigned_by_user_id_fkey`
    FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `simulation_sessions`
    ADD CONSTRAINT `sim_sessions_assignment_fkey`
    FOREIGN KEY (`training_assignment_id`) REFERENCES `training_assignments`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `sim_sessions_program_item_fkey`
    FOREIGN KEY (`training_program_item_id`) REFERENCES `training_program_items`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
