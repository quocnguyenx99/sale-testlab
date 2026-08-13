CREATE TABLE `session_coaching_feedback` (
    `id` CHAR(36) NOT NULL,
    `evaluation_id` CHAR(36) NOT NULL,
    `coach_version` VARCHAR(80) NOT NULL,
    `status` ENUM('COMPLETED', 'FAILED') NOT NULL,
    `summary` TEXT NULL,
    `priorities_json` JSON NULL,
    `strength_reinforcement_json` JSON NULL,
    `next_practice_focus_json` JSON NULL,
    `failure_code` VARCHAR(80) NULL,
    `coached_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `session_coaching_feedback_evaluation_id_coach_version_key`(`evaluation_id`, `coach_version`),
    INDEX `session_coaching_feedback_status_coached_at_idx`(`status`, `coached_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `session_coaching_feedback`
    ADD CONSTRAINT `session_coaching_feedback_evaluation_id_fkey`
    FOREIGN KEY (`evaluation_id`) REFERENCES `session_evaluations`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
